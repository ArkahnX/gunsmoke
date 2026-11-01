import {
	type SaveV8SelectedDoll,
	type SaveV8,
	type SaveV10,
	type SaveV9,
	type SaveV9SelectedDoll,
	type SaveV9Action,
	type SaveV9TabData,
	type DollEquipment,
	type DollAction,
	type SkillData,
	ActionType,
	Turn,
	DollTurn,
	SaveV7,
	AnySave,
	CurrentSave,
	SaveV8TabData,
} from "../types/saves";
import idMapping from "../../gfl2-data/id-mapping.json";
import { AttachmentId, BuffId, Doll, KeyId, RemoldingId, SkillId, DollId, Summon, SummonId, WeaponId } from "../../gfl2-data/types";
import { getMapByName, isBuiltInMap } from "../canvas/editorMap";
import {
	getDollById,
	getSelectedDoll,
	getSummonOwnerId,
	getSummonRequirement,
	getWeaponByDollId,
	hasPrefix,
	hasSkillFamily,
	hasSummonFamily,
	isEverPlayable,
	resolveSkill,
	resolveSummon,
	summonBaseIdOf,
} from "./gameData";
import { log } from "../log";
import { IdKey } from "../../gfl2-data/enums";
import { defaultLocalState } from "./appState";
import {
	END_TURN_SKILL_ID,
	REMOLDING_LEVELS,
	V10_SAVE_VERSION,
	V7_SKILL_DISPLAY_KEY,
	V8_SKILL_DISPLAY_KEY,
	V9_DOLL_LOADOUT_KEY,
	V9_END_TURN_SKILL_ID,
	V9_LOCAL_STATE,
	V9_SAVE_VERSION,
} from "../types/constants";
import { localStorageLoad } from "./storage";

export class SaveImportError extends Error {}

interface IdMapping {
	dolls: Record<string, DollId>;
	summons: Record<string, SummonId>;
	/** old skill owner id (doll or summon) -> old skill number -> new skill id */
	skills: Record<string, Record<string, SkillId>>;
	/** old doll id -> old key id -> new id */
	keys: Record<string, Record<string, KeyId>>;
	weapons: Record<string, WeaponId>;
	buffs: Record<string, BuffId>;
	/** old summon id -> new id of the doll that owns it (its fortification decides the summon's skill ids) */
	summonOwners: Record<string, DollId>;
}

const mapping = idMapping as IdMapping;

// a#/c# ids are globally unique, but a doll's loadout can use another doll's ones
// (e.g. d56 equips c55), so we need a flat lookup across every doll's key table.
const flatKeyLookup: Record<string, KeyId> = {};
for (const table of Object.values(mapping.keys)) {
	for (const [oldId, newId] of Object.entries(table)) {
		// k1..k7 repeat for every doll and are NOT globally unique, so skip them here
		if (!/^k\d+$/.test(oldId)) flatKeyLookup[oldId] = newId;
	}
}

/** v7/v8 buffs can be missing or hold non-string entries; always returns a string array. */
function toBuffList(buffs: unknown): string[] {
	if (!Array.isArray(buffs)) return [];
	return buffs.filter((b): b is string => typeof b === "string");
}

function isLegacySummonId(id: string) {
	return /^s\d+$/.test(id);
}

function lookup<T extends string>(table: Record<string, T> | undefined, id: string, what: string): T {
	const result = table?.[id];
	if (result === undefined) throw new SaveImportError(`[v8->v9] No mapping for ${what} "${id}"`);
	return result;
}

function mapKey(dollId: string, keyId: string): KeyId {
	// Doll-specific table first (handles k1..k7), then the global a#/c# lookup
	const own = mapping.keys[dollId]?.[keyId];
	if (own !== undefined) return own;
	return lookup(flatKeyLookup, keyId, `key (on doll ${dollId})`);
}

function mapDollEquipment(d: SaveV9SelectedDoll): DollEquipment {
	return {
		id: d.id,
		fortification: d.fortification,
		affinity: 0,
		borrow: d.borrow,
		keys: d.keys.filter((k): k is KeyId => k !== "").map((id) => ({ id, stats: {} })),
		remolding: {
			level: d.remoldingLvl,
			stats: {} as Record<RemoldingId, number>,
		},
		gun: {
			id: d.gun,
			calibration: 0,
			set: "" as AttachmentId,
			stats: {},
		},
	};
}

/**
 * Resolves old (v8) ids against the migrated dolls, so summon and skill ids match what the runtime shows for each doll's
 * fortification and keys. Known ids that aren't available on the doll (missing key, fortification too low, owner not
 * selected) fall back to the family's base id and are kept; `validateSave` reports them.
 */
function makeResolvers(newDolls: SaveV9SelectedDoll[]) {
	// locked skills included, so a skill waiting on a key or fortification still gets its tier for this loadout
	const resolved = new Map<DollId, Doll>(newDolls.map((sd) => [sd.id, getSelectedDoll(sd, true)]));

	function summon(oldId: string): SummonId {
		const base = lookup(mapping.summons, oldId, "summon");
		const owner = resolved.get(lookup(mapping.summonOwners, oldId, "summon owner"));
		if (!owner || !hasSummonFamily(base, owner)) return base;
		return resolveSummon(base, owner).id;
	}

	function skill(oldOwnerId: string, skillNumber: number): SkillId {
		if (skillNumber === END_TURN_SKILL_ID) return V9_END_TURN_SKILL_ID;
		const base = lookup(mapping.skills[oldOwnerId], String(skillNumber), `skill of ${oldOwnerId}`);
		let entity: Doll | Summon | undefined;
		if (isLegacySummonId(oldOwnerId)) {
			const doll = resolved.get(lookup(mapping.summonOwners, oldOwnerId, "summon owner"));
			const summonId = summon(oldOwnerId);
			entity = doll && hasSummonFamily(summonId, doll) ? resolveSummon(summonId, doll) : undefined;
		} else {
			entity = resolved.get(lookup(mapping.dolls, oldOwnerId, "doll"));
		}
		if (!entity || !hasSkillFamily(base, entity)) return base;
		return resolveSkill(base, entity).id;
	}

	function owner(oldId: string): DollId | SummonId {
		return isLegacySummonId(oldId) ? summon(oldId) : lookup(mapping.dolls, oldId, "doll");
	}

	return { summon, skill, owner };
}

function mapActions(actions: SaveV9Action[]): DollAction[] {
	return actions.map(([skillNumber, targetId]) => {
		if (skillNumber === V9_END_TURN_SKILL_ID) return { type: ActionType.EndTurn };
		const data: SkillData = { id: skillNumber };
		if (targetId !== undefined) data.target = { id: targetId, instance: null };
		return { type: ActionType.Skill, data };
	});
}

function mapTurn(tab: SaveV9TabData): Turn {
	const dolls: DollTurn[] = [];
	const seenSummons = new Set<string>();

	for (const id of tab.actionOrder) {
		const actions = tab.actions[id] ?? [];

		if (hasPrefix(id, IdKey.Summons)) {
			// A summon can have several placed instances; actions in v8are keyed by summon id only,
			// so attach them to the first instance and leave the rest with none.
			const placed = tab.summonPositions.filter((s) => s.id === id);
			// Not on the field yet in this turn -> skip until it has a position
			placed.forEach((s, i) => {
				dolls.push({
					id,
					instance: s.mapId,
					position: { x: s.x, y: s.y },
					actions: i === 0 ? mapActions(actions) : [],
				});
			});
			seenSummons.add(id);
		} else {
			const pos = tab.dollPositions[id];
			if (!pos) continue;
			dolls.push({
				id,
				instance: "",
				position: { x: pos.x, y: pos.y },
				actions: mapActions(actions),
			});
		}
	}

	// Safety net: summons that are on the field but missing from actionOrder
	for (const s of tab.summonPositions) {
		if (seenSummons.has(s.id)) continue;
		dolls.push({
			id: s.id,
			instance: s.mapId,
			position: { x: s.x, y: s.y },
			actions: [],
		});
	}

	return { dolls };
}

export function v9ToV10(save: SaveV9): SaveV10 {
	return {
		dolls: save.selectedDolls.map((d) => mapDollEquipment(d)),
		turns: save.tabData.map((tab) => mapTurn(tab)),
		buffs: [...save.buffs],
		mapId: isBuiltInMap(save.map) ? getMapByName(save.map).id : (save.customMap?.id ?? "custom"),
		description: save.description,
		score: save.score,
		version: 10,
	};
}

/** Converts each owner's actions, appending lists whose old owners map to the same new id instead of overwriting them. */
function mergeActions(actions: SaveV8TabData["actions"], resolve: ReturnType<typeof makeResolvers>): Record<string, SaveV9Action[]> {
	const merged: Record<string, SaveV9Action[]> = {};
	for (const [oldOwnerId, list] of Object.entries(actions)) {
		const converted = list.map(([skill, target]): SaveV9Action => {
			const id = resolve.skill(oldOwnerId, skill);
			return target === undefined ? [id] : [id, resolve.owner(target)];
		});
		const ownerId = resolve.owner(oldOwnerId);
		merged[ownerId] = [...(merged[ownerId] ?? []), ...converted];
	}
	return merged;
}

function mapRecordKeys<K extends string, T>(rec: Record<string, T>, fn: (key: string) => K): Record<K, T> {
	return Object.fromEntries(Object.entries(rec).map(([k, v]) => [fn(k), v])) as Record<K, T>;
}

/**
 * Keeps the v8 structure (tabs, actionOrder, positions, ...) but converts all IDs to v9 IDs.
 * Empty values stay empty (`gun: ""`, `""` key slots) so the v8 shape is unchanged.
 * Skill lookups use the OLD owner id, so everything is converted in a single pass.
 */

export function v8ToV9SelectedDoll(doll: SaveV8SelectedDoll): SaveV9SelectedDoll {
	return {
		id: lookup(mapping.dolls, doll.id, "doll"),
		fortification: doll.fortification,
		// some v7/v8 saves have null for an empty slot
		keys: doll.keys.map((k) => (k === null || k === "" ? "" : mapKey(doll.id, k))),
		// v8 could store remolding levels the game doesn't have; fall back to the first real one
		remoldingLvl: REMOLDING_LEVELS.includes(doll.remoldingLvl) ? doll.remoldingLvl : REMOLDING_LEVELS[0],
		gun: doll.gun === "" ? getWeaponByDollId(lookup(mapping.dolls, doll.id, "doll")).id : lookup(mapping.weapons, doll.gun, "weapon"),
		borrow: doll.borrow,
	};
}

export function v8ToV9(save: SaveV8): SaveV9 {
	// bugfix to get rid of anything not a doll from dollPositions
	const tabDataBugfix = structuredClone(save.tabData);
	for (const tab of tabDataBugfix) {
		for (const key of Object.keys(tab.dollPositions)) {
			if (!hasPrefix(key, IdKey.Dolls)) {
				// eslint-disable-next-line @typescript-eslint/no-dynamic-delete
				delete tab.dollPositions[key];
			}
		}
	}
	// dolls first: summon and skill ids resolve against the migrated dolls' fortification and keys
	const newSelectedDolls: SaveV9SelectedDoll[] = save.selectedDolls.map(v8ToV9SelectedDoll);
	const resolve = makeResolvers(newSelectedDolls);
	const newTabData: SaveV9TabData[] = tabDataBugfix.map((tab) => ({
		// several old ids can map to one new id (e.g. Mityl's s10 and s11), so dedupe the order and merge their actions
		actionOrder: [...new Set(tab.actionOrder.map(resolve.owner))],
		actions: mergeActions(tab.actions, resolve),
		dollPositions: mapRecordKeys(tab.dollPositions, (id) => lookup(mapping.dolls, id, "doll")),
		summonPositions: tab.summonPositions.map((s) => ({
			...s,
			id: resolve.summon(s.id),
		})),
	}));
	return {
		selectedDolls: newSelectedDolls,
		// older v8 saves can be missing the map
		map: save.map ?? "Blade Guard Titan",
		score: save.score,
		description: save.description,
		buffs: toBuffList(save.buffs).map((b) => lookup(mapping.buffs, b, "buff")),
		tabData: assignUniqueInstanceIds(cleanUpSummons(newTabData, newSelectedDolls)),
		version: V9_SAVE_VERSION,
	};
}

/**
 * v8 recorded summons loosely, so after converting:
 * - summons placed on turn 0 (setup) are removed, since summons only exist from turn 1
 * - a summon on the map whose doll isn't selected is a broken save, so the import fails
 * - summons in the action order or action list that aren't on that turn's map are removed
 * - action listings of summons that are never playable are removed; `isEverPlayable` checks the whole summon family
 *   (base, fortification tiers and key replacements), so a summon with a playable upgrade keeps its actions
 */
function cleanUpSummons(tabs: SaveV9TabData[], dolls: SaveV9SelectedDoll[]): SaveV9TabData[] {
	const selected = new Set<DollId>(dolls.map((d) => d.id));
	return tabs.map((original, tabIndex) => {
		let tab = original;
		if (tabIndex === 0 && tab.summonPositions.length) {
			log.info(`[v8->v9] Setup: removed summons, which can only be placed from turn 1`, tab.summonPositions);
			tab = { ...tab, summonPositions: [] };
		}
		for (const position of tab.summonPositions) {
			const ownerId = getSummonOwnerId(position.id);
			if (!selected.has(ownerId)) {
				const summonName = getSummonRequirement(position.id).name;
				throw new SaveImportError(
					`[v8->v9] Turn ${tabIndex}: ${summonName} (${position.id}) is on the map, but ${getDollById(ownerId).name} (${ownerId}) is not in the team`
				);
			}
		}
		const placed = new Set<SummonId>(tab.summonPositions.map((p) => p.id));
		const isUnplacedSummon = (id: DollId | SummonId) => hasPrefix(id, IdKey.Summons) && !placed.has(id);

		// unplaced summons are always removed, but only ones with recorded actions are worth logging
		const removedActions: Record<string, SaveV9Action[]> = {};
		const removedListings: Record<string, SaveV9Action[]> = {};
		const actions: Record<string, SaveV9Action[]> = {};
		for (const [ownerKey, list] of Object.entries(tab.actions)) {
			const ownerId = ownerKey as DollId | SummonId;
			if (isUnplacedSummon(ownerId)) {
				if (list.length) removedActions[ownerId] = list;
			} else if (hasPrefix(ownerId, IdKey.Summons) && !isEverPlayable(ownerId)) {
				// empty listings are dropped silently; only ones with recorded actions are worth logging
				if (list.length) removedListings[ownerId] = list;
			} else {
				actions[ownerId] = list;
			}
		}
		if (Object.keys(removedActions).length) {
			log.info(`[v8->v9] Turn ${tabIndex}: removed summons that are not on the map`, {
				actionOrder: tab.actionOrder.filter((id) => id in removedActions),
				actions: removedActions,
			});
		}
		if (Object.keys(removedListings).length) {
			log.info(`[v8->v9] Turn ${tabIndex}: removed listings of summons that are never playable`, removedListings);
		}
		return { ...tab, actionOrder: tab.actionOrder.filter((id) => !isUnplacedSummon(id)), actions };
	});
}

/** A summon placement while instance ids are being reassigned. */
interface SummonInstance {
	base: SummonId;
	oldMapId: string;
	x: number;
	y: number;
	mapId: string;
	/** how `mapId` was decided, for the migration log */
	source: InstanceIdSource | undefined;
}

type InstanceIdSource = "sameTile" | "sameOldId" | "new";

const INSTANCE_ID_SOURCE_LABELS: Record<InstanceIdSource, string> = {
	sameTile: "continued from the previous turn (same tile)",
	sameOldId: "continued from the previous turn (same old id, moved)",
	new: "new instance",
};

const INSTANCE_ID_SOURCE_SHORT: Record<InstanceIdSource, string> = {
	sameTile: "same tile",
	sameOldId: "moved",
	new: "new",
};

/**
 * v8 numbered summon placements per turn (`s${count}`), so ids can be missing, repeat across turns, or repeat within
 * one. Every placed instance gets a timeline-wide unique id. A placement continues an instance from the previous turn when
 * that turn had the same summon on the same tile, or failing that, the same summon with the same old id (a copied
 * placement that moved). Each previous instance is continued at most once; anything unmatched is a new instance.
 */
function assignUniqueInstanceIds(tabs: SaveV9TabData[]): SaveV9TabData[] {
	let next = 0;
	let previous: SummonInstance[] = [];
	return tabs.map((tab, tabIndex) => {
		const unclaimed = [...previous];
		const claim = (matches: (prev: SummonInstance) => boolean) => {
			const index = unclaimed.findIndex(matches);
			return index === -1 ? "" : unclaimed.splice(index, 1)[0].mapId;
		};
		const current: SummonInstance[] = tab.summonPositions.map((p) => ({
			base: summonBaseIdOf(p.id),
			// v8 placements can be missing their id entirely
			oldMapId: (p.mapId as string | undefined) ?? "",
			x: p.x,
			y: p.y,
			mapId: "",
			source: undefined,
		}));
		const assign = (c: SummonInstance, mapId: string, source: InstanceIdSource) => {
			if (!mapId) return;
			c.mapId = mapId;
			c.source = source;
		};
		// same summon on the same tile as last turn
		for (const c of current)
			assign(
				c,
				claim((p) => p.base === c.base && p.x === c.x && p.y === c.y),
				"sameTile"
			);
		// same summon with the same old id: a copied placement that moved
		for (const c of current) {
			if (!c.source && c.oldMapId)
				assign(
					c,
					claim((p) => p.base === c.base && p.oldMapId === c.oldMapId),
					"sameOldId"
				);
		}
		for (const c of current) if (!c.source) assign(c, `s${next++}`, "new");

		logInstanceIds(tabIndex, tab.summonPositions, current);
		const summonPositions = tab.summonPositions.map((p, i) => ({ ...p, mapId: current[i].mapId }));
		previous = current;
		return { ...tab, summonPositions };
	});
}

/** One log line per turn, grouping each changed instance id by how it was decided; ids kept from the old save aren't logged. */
function logInstanceIds(tabIndex: number, positions: SaveV9TabData["summonPositions"], instances: SummonInstance[]) {
	const groups: Partial<Record<string, string[]>> = {};
	const counts: string[] = [];
	for (const source of Object.keys(INSTANCE_ID_SOURCE_LABELS) as InstanceIdSource[]) {
		const entries = positions.flatMap((p, i) => {
			const { mapId, oldMapId } = instances[i];
			if (instances[i].source !== source || mapId === oldMapId) return [];
			return [`${p.id} at (${p.x}, ${p.y}): ${oldMapId || "(no id)"} -> ${mapId}`];
		});
		if (!entries.length) continue;
		groups[INSTANCE_ID_SOURCE_LABELS[source]] = entries;
		counts.push(`${entries.length} ${INSTANCE_ID_SOURCE_SHORT[source]}`);
	}
	if (!counts.length) return;
	log.info(`[v8->v9] Turn ${tabIndex}: summon instance ids (${counts.join(", ")})`, groups);
}

export function v7ToV8(data: SaveV7): SaveV8 {
	// no longer upconvert actionType to skillDisplay as the format has changed
	const v8SelectedDolls = structuredClone(data.selectedDolls).map((d) => ({
		id: d.id,
		fortification: d.fortification ?? 0,
		keys: d.keys?.length === 8 ? d.keys.map((k) => k ?? "") : Array<string>(8).fill(""),
		remoldingLvl: d.remoldingLvl ?? 1,
		gun: d.gun ?? "",
		borrow: d.borrow ?? false,
	}));
	const v8TabData = Array.from({ length: 8 }, (_, i) => (data.tabData[i] ? structuredClone(data.tabData[i]) : makeV8DefaultTabData()));
	return {
		selectedDolls: v8SelectedDolls,
		currentTab: data.currentTab,
		map: data.map ?? "Tusk Beasteel",
		score: 0,
		description: "",
		buffs: toBuffList(data.buffs),
		tabData: v8TabData,
		version: 8,
	};
}

export function makeV8DefaultTabData(): SaveV8TabData {
	return { actionOrder: [], actions: {}, dollPositions: {}, summonPositions: [] };
}

export function assertSave(save: unknown): AnySave {
	if (!save || typeof save !== "object" || !("version" in save) || typeof save.version !== "number") {
		throw new SaveImportError("Not a save: the data has no version number");
	}
	if (save.version < 7) {
		throw new SaveImportError(`Save version ${save.version} is too old (oldest supported is 7)`);
	}
	if (save.version > V10_SAVE_VERSION) {
		throw new SaveImportError(`Save version ${save.version} is newer than this app supports (${V10_SAVE_VERSION})`);
	}
	if (save.version >= 7 && save.version < 10) {
		if (!("selectedDolls" in save) || !Array.isArray(save.selectedDolls)) {
			throw new SaveImportError(`Save version ${save.version} has no selectedDolls list`);
		}
		if (!("tabData" in save) || !Array.isArray(save.tabData)) {
			throw new SaveImportError(`Save version ${save.version} has no tabData list`);
		}
	}
	if (save.version >= 10) {
		if (!("dolls" in save) || !Array.isArray(save.dolls)) {
			throw new SaveImportError(`Save version ${save.version} has no dolls list`);
		}
		if (!("turns" in save) || !Array.isArray(save.turns)) {
			throw new SaveImportError(`Save version ${save.version} has no turns list`);
		}
	}

	return save as AnySave;
}

export function upgradeSave(raw: unknown): CurrentSave {
	let save: AnySave = assertSave(raw);
	if (save.version === 7) save = v7ToV8(save);
	if (save.version === 8) save = v8ToV9(save);
	// if (save.version === 9) save = v9ToV10(save);  // enable with CurrentSave = SaveV10
	if (save.version !== V9_SAVE_VERSION) throw new SaveImportError(`Save version ${save.version} can't be loaded yet`);
	return save;
}

export function migrate() {
	if (!localStorage.getItem(V9_LOCAL_STATE)) {
		const local = structuredClone(defaultLocalState);
		if (localStorage.getItem(V8_SKILL_DISPLAY_KEY)) {
			const v8Skills = localStorageLoad(V8_SKILL_DISPLAY_KEY);
			if (v8Skills && typeof v8Skills === "object" && "skillDisplay" in v8Skills && Array.isArray(v8Skills.skillDisplay)) {
				for (const [index, value] of v8Skills.skillDisplay.entries()) {
					if (typeof value === "number") {
						local.skillDisplay[index] = value;
					}
				}
			}
		} else if (localStorage.getItem(V7_SKILL_DISPLAY_KEY)) {
			const v7Skills = localStorageLoad(V7_SKILL_DISPLAY_KEY);
			if (v7Skills && typeof v7Skills === "object" && "skillDisplay" in v7Skills && Array.isArray(v7Skills.skillDisplay)) {
				for (const [index, value] of v7Skills.skillDisplay.entries()) {
					if (typeof value === "number") {
						local.skillDisplay[index] = value;
					}
				}
			}
		}
		localStorage.setItem(V9_LOCAL_STATE, JSON.stringify(local));
	}
	// snapshot the keys first: setItem/removeItem below reorder localStorage, so indexing it live would skip entries
	const keys = Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i));
	for (const key of keys) {
		if (key && key.startsWith("gunsmoke_doll_") && key.endsWith("_v8")) {
			try {
				const loadout = localStorageLoad(key) as SaveV8SelectedDoll | null;
				if (loadout) {
					const newLoadout = v8ToV9SelectedDoll(loadout);
					localStorage.setItem(V9_DOLL_LOADOUT_KEY(newLoadout.id), JSON.stringify(newLoadout));
					localStorage.removeItem(key);
				}
			} catch (e) {
				log.error(`Couldn't migrate the saved v8 doll loadout "${key}"`, e);
			}
		}
	}
	// do not migrate V7_EDITOR_MAP_KEY, V8_CUSTOM_MAP_KEY
}
