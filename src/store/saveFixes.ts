import { produce, unwrap } from "solid-js/store";
import { DollId, KeyId, SkillId, SummonId } from "../../gfl2-data/types";
import { IdKey, KeyType, KeyTypeLabels } from "../../gfl2-data/enums";
import { KEY_SLOTS, MAX_TEAM_SIZE } from "../types/constants";
import { SaveV9, SaveV9Action, SaveV9SelectedDoll, SaveV9TabData } from "../types/saves";
import { setRetargetAction, setShowTargetModal, setTargetDollId, setTargetSkillId } from "./uiState";
import { nextSummonInstanceId, setState, state } from "./appState";
import { loadMap } from "../canvas/editorMap";
import { preloadCanvasImages } from "./images";
import { saveToLocalStorage } from "./storage";
import { applySelectedDolls, changeSelectedDolls, defaultActionOrder, defaultLoadout, setupTempSelectedDolls } from "./dollSelection";
import {
	getDollById,
	getKeyById,
	getSelectedDoll,
	getSkillRequirement,
	getSkillTier,
	getSummonOwnerId,
	getTargetCandidates,
	getWeaponById,
	hasExpansionKey,
	hasPrefix,
	isKnownKeyId,
	isKnownSkillId,
	isKnownSummonId,
	isKnownWeaponId,
	summonBaseIdOf,
} from "./gameData";
import { entityName, ErrorGroup, fixKey, isAutoFix, keyName, uniqueMessages, validateSave } from "./validation";
import { FixKey, LocationKey, PositionLocation, SaveError, SaveFix, SaveLocation } from "../types/issues";

export { isAutoFix };

/** Stops a fix loop that keeps finding work, e.g. two fixes undoing each other. */
const MAX_FIX_STEPS = 500;

/**
 * The doll and key when full key slots are the only thing stopping `fix` (an equip), so the doll's equipment can be
 * opened to swap a key out by hand; undefined for every other fix.
 */
export function fullSlotsEquip(fix: SaveFix): { dollId: DollId; keyId: KeyId } | undefined {
	if (fix.kind !== FixKey.EquipKey || !isKnownKeyId(fix.keyId)) return undefined;
	const sd = selectedDoll(fix.dollId);
	if (!sd || sd.keys.includes(fix.keyId)) return undefined;
	return freeKeySlots(sd, getKeyById(fix.keyId).type) > 0 ? undefined : { dollId: fix.dollId, keyId: fix.keyId };
}

/**
 * What swapping `outKey` for `inKey` ("" for an empty slot) on `dollId` would cost the timeline: issues that would newly
 * appear, recorded skills that would drop the version `outKey` gives, and summons that would leave the timeline. Previewed
 * on copies of the timeline with ids moved the way confirming the equipment moves them. `team` is the loadouts being edited.
 * The equipment modal's key locks come from this too, so team rules the validator checks (such as a common key shared
 * with another doll, see `checkSharedKeys`) show in the swap text without the modal repeating them.
 */
export function keySwapImpact(team: SaveV9SelectedDoll[], dollId: DollId, outKey: KeyId | "", inKey: KeyId): string[] {
	const preview = (dolls: SaveV9SelectedDoll[]) => {
		const timeline = structuredClone(unwrap(state));
		applySelectedDolls(timeline, dolls);
		return timeline;
	};
	const copy = () => structuredClone(team.map((sd) => unwrap(sd)));
	const before = preview(copy());
	const swapped = copy();
	const sd = swapped.find((d) => d.id === dollId);
	if (sd) {
		const index = sd.keys.indexOf(outKey);
		if (index === -1) sd.keys.push(inKey);
		else sd.keys[index] = inKey;
	}
	const after = preview(swapped);
	const known = new Set(uniqueMessages(validateSave(before)));
	const impact = new Set(uniqueMessages(validateSave(after)).filter((message) => !known.has(message)));
	if (outKey !== "") for (const loss of lostToKey(before, after, outKey)) impact.add(loss);
	return [...impact];
}

/** Doll ids as they are, summon ids by family, so an owner is matched across a tier or key rename. */
const ownerBase = (id: DollId | SummonId) => (hasPrefix(id, IdKey.Summons) ? summonBaseIdOf(id) : id);

/**
 * What confirming the equipment quietly changes when `outKey` goes (no issue reports it): recorded skills moved off the
 * version `outKey` gives, and summons whose placements and actions are dropped.
 */
function lostToKey(before: SaveV9, after: SaveV9, outKey: KeyId): string[] {
	const lost = new Set<string>();
	for (const [tabIndex, tab] of before.tabData.entries()) {
		const afterTab = after.tabData[tabIndex];
		const afterActions = new Map(
			Object.entries(afterTab.actions).map(([id, actions]) => [ownerBase(id as DollId | SummonId), actions])
		);
		for (const [ownerKey, actions] of Object.entries(tab.actions)) {
			const ownerId = ownerKey as DollId | SummonId;
			const now = afterActions.get(ownerBase(ownerId));
			if (!actions.length) continue;
			if (!now?.length) {
				if (hasPrefix(ownerId, IdKey.Summons))
					lost.add(`${entityName(ownerId)} and all its placements and actions are removed from the timeline`);
				continue;
			}
			for (const [index, [skillId]] of actions.entries()) {
				const newId = now[index]?.[0];
				if (newId === undefined || newId === skillId || !isKnownSkillId(skillId) || !isKnownSkillId(newId)) continue;
				if (getSkillTier(skillId).keyId !== outKey) continue;
				lost.add(`${entityName(ownerId)}'s "${getSkillRequirement(skillId).name}" loses the bonus from ${keyName(outKey)}`);
			}
		}
		const placedAfter = new Set(afterTab.summonPositions.map((p) => summonBaseIdOf(p.id)));
		for (const p of tab.summonPositions) {
			if (!placedAfter.has(summonBaseIdOf(p.id)))
				lost.add(`${entityName(p.id)} and all its placements and actions are removed from the timeline`);
		}
	}
	return [...lost];
}

function selectedDoll(dollId: DollId): SaveV9SelectedDoll | undefined {
	return state.selectedDolls.find((sd) => sd.id === dollId);
}

/** Slots of `type` the doll has (the expansion slot only exists for some dolls), minus the ones its keys fill. */
function freeKeySlots(sd: SaveV9SelectedDoll, type: KeyType): number {
	const doll = getSelectedDoll(sd);
	const slots = KEY_SLOTS.filter((slot) => slot === type && (slot !== KeyType.ExpansionKey || hasExpansionKey(doll))).length;
	const used = new Set(sd.keys.filter((keyId): keyId is KeyId => keyId !== "" && isKnownKeyId(keyId) && getKeyById(keyId).type === type));
	return slots - used.size;
}

type CopyPositionFix = Extract<SaveFix, { kind: "copyPosition" }>;

/** `setup` or `turn 2` */
function turnName(tab: number): string {
	return tab === 0 ? "setup" : `turn ${tab}`;
}

/** Where `fix` would place its doll or summon: every placement it had on `fromTab` (a summon can have several). */
function copiedPlacements(fix: CopyPositionFix): { x: number; y: number; mapId?: string }[] {
	const from = state.tabData[fix.fromTab] as SaveV9TabData | undefined;
	if (!from) return [];
	if (hasPrefix(fix.id, IdKey.Dolls)) {
		const position = from.dollPositions[fix.id] as SaveV9TabData["dollPositions"][DollId] | undefined;
		return position && position.x > -1 && position.y > -1 ? [{ x: position.x, y: position.y }] : [];
	}
	// any tier/key version of the summon, the same way the checker decides it was on the map
	const base = summonBaseIdOf(fix.id);
	return from.summonPositions.filter((p) => summonBaseIdOf(p.id) === base).map((p) => ({ x: p.x, y: p.y, mapId: p.mapId }));
}

/** Name of whoever stands on (x, y) on `tabIndex` other than `id`; undefined when the tile is free. */
function occupantOf(tabIndex: number, x: number, y: number, id: DollId | SummonId): string | undefined {
	const tab = state.tabData[tabIndex];
	for (const [dollId, position] of Object.entries(tab.dollPositions) as [DollId, SaveV9TabData["dollPositions"][DollId]][]) {
		if (dollId !== id && position.x === x && position.y === y) return entityName(dollId);
	}
	const summon = tab.summonPositions.find((p) => p.x === x && p.y === y);
	return summon ? entityName(summon.id) : undefined;
}

const NOTHING_TO_REMOVE = new Set<SaveLocation["kind"]>([LocationKey.Timeline, LocationKey.Map, LocationKey.Doll, LocationKey.DollWeapon]);

/** Whether the fix can be performed on the current timeline (a free key slot, room in the team, something to remove). */
export function canApplyFix(fix: SaveFix): boolean {
	switch (fix.kind) {
		case FixKey.EquipKey: {
			const sd = selectedDoll(fix.dollId);
			if (!sd || sd.keys.includes(fix.keyId) || !isKnownKeyId(fix.keyId)) return false;
			return freeKeySlots(sd, getKeyById(fix.keyId).type) > 0;
		}
		case FixKey.SelectDoll:
			return !selectedDoll(fix.dollId) && state.selectedDolls.length < MAX_TEAM_SIZE;
		case FixKey.RemoveEntry:
			return !NOTHING_TO_REMOVE.has(fix.location.kind);
		case FixKey.SetMap:
		case FixKey.ReplaceId:
		case FixKey.KeepOnTile:
			return true;
		case FixKey.ChooseTarget:
			return getTargetCandidates(fix.location.ownerId, fix.location.tab).length > 0;
		case FixKey.CopyPosition: {
			const placements = copiedPlacements(fix);
			return placements.length > 0 && placements.every((p) => occupantOf(fix.tab, p.x, p.y, fix.id) === undefined);
		}
		case FixKey.PlaceAt:
			return occupantOf(fix.tab, fix.x, fix.y, fix.id) === undefined;
		default:
			return selectedDoll(fix.dollId) !== undefined;
	}
}

/** `cantApplyReason` when nothing more specific can be said. */
export const MANUAL_FIX_REASON = "Please manually fix this issue";

/** Why `canApplyFix` is false, for the disabled button's tooltip and the note under it. */
export function cantApplyReason(fix: SaveFix): string {
	if (fix.kind === FixKey.EquipKey && isKnownKeyId(fix.keyId)) {
		return `${getDollById(fix.dollId).name} has no free ${KeyTypeLabels[getKeyById(fix.keyId).type]} slot; unequip one first`;
	}
	if (fix.kind === FixKey.SelectDoll) return `The team already has ${MAX_TEAM_SIZE} dolls`;
	if (fix.kind === FixKey.ChooseTarget) {
		return `No other ally is on the map ${fix.location.tab === 0 ? "in setup" : `on turn ${fix.location.tab}`}`;
	}
	if (fix.kind === FixKey.CopyPosition) {
		const name = entityName(fix.id);
		for (const p of copiedPlacements(fix)) {
			const occupant = occupantOf(fix.tab, p.x, p.y, fix.id);
			if (occupant) return `${occupant} is on ${name}'s tile from ${turnName(fix.fromTab)}; move them first`;
		}
		return `${name} is no longer on the map ${describeTurns([fix.fromTab])}`;
	}
	if (fix.kind === FixKey.PlaceAt) {
		return `${occupantOf(fix.tab, fix.x, fix.y, fix.id) ?? "Someone"} is already on that tile`;
	}
	return MANUAL_FIX_REASON;
}

function dollName(id: DollId) {
	return getDollById(id).name;
}

/** The doll whose loadout decides which version of `id` is used: a summon's owner, or the doll a skill (or its summon) belongs to. */
function loadoutOwner(id: SkillId | SummonId): DollId {
	const owner = hasPrefix(id, IdKey.Summons) ? id : getSkillRequirement(id).ownerId;
	return hasPrefix(owner, IdKey.Summons) ? getSummonOwnerId(owner) : owner;
}

/** Button label for the fix, e.g. `Equip Fixed Key "Mistress of Disguise" on Mityl`. */
export function describeFix(fix: SaveFix): string {
	switch (fix.kind) {
		case FixKey.EquipKey:
			return `Equip ${keyName(fix.keyId)} on ${dollName(fix.dollId)}`;
		case FixKey.UnequipKey:
			return `Unequip ${isKnownKeyId(fix.keyId) ? keyName(fix.keyId) : `unknown key "${String(fix.keyId)}"`}`;
		case FixKey.SetFortification:
			return `Set ${dollName(fix.dollId)} to V${fix.fortification}`;
		case FixKey.ReplaceId: {
			const known = hasPrefix(fix.to, IdKey.Summons) ? isKnownSummonId(fix.to) : isKnownSkillId(fix.to);
			return known ? `Update to match ${dollName(loadoutOwner(fix.to))}'s current loadout` : "Update to match the current loadout";
		}
		case FixKey.SetWeapon:
			return isKnownWeaponId(fix.weaponId) ? `Use signature weapon "${getWeaponById(fix.weaponId).name}"` : "Use signature weapon";
		case FixKey.SetRemolding:
			return `Set remolding to ${fix.level}`;
		case FixKey.SetBorrow:
			if (!fix.borrow) return `Set ${dollName(fix.dollId)} as not borrowed`;
			// with others borrowed, setting one clears them, so it reads as the choice of which one stays
			return state.selectedDolls.some((sd) => sd.borrow)
				? `Keep ${dollName(fix.dollId)} as the borrowed doll`
				: `Set ${dollName(fix.dollId)} as the borrowed doll`;
		case FixKey.SelectDoll:
			return `Add ${dollName(fix.dollId)} to the team`;
		case FixKey.SetMap:
			return `Change map to ${fix.map}`;
		case FixKey.RemoveEntry:
			return describeRemoval([fix.location]);
		case FixKey.ChooseTarget:
			return "Choose a new target";
		case FixKey.CopyPosition:
			return `Copy ${entityName(fix.id)}'s position from ${turnName(fix.fromTab)}`;
		case FixKey.PlaceAt:
			if (fix.near) return `Place ${entityName(fix.id)} on the free tile nearest ${dollName(fix.near)}`;
			return `Place ${entityName(fix.id)} on an open spawn tile`;
		case FixKey.KeepOnTile:
			// keeping one takes the others off the map that turn, so it reads as the choice of which one stays
			return `Keep ${positionName(fix.keep)} on the tile`;
	}
}

/** Who stands at a position location, e.g. `Krolik` or `Hologram - Mityl`. */
function positionName(location: PositionLocation): string {
	if (location.kind === LocationKey.DollPosition) return entityName(location.dollId);
	const position = state.tabData[location.tab]?.summonPositions[location.index] as SaveV9TabData["summonPositions"][number] | undefined;
	return position ? entityName(position.id) : "the summon";
}

/** What removing the entry at `location` deletes, e.g. `Self Hologram's actions` or `Self Hologram from the map`. */
function removalTarget(location: SaveLocation): string {
	switch (location.kind) {
		case LocationKey.Action:
			return "this skill use";
		case LocationKey.ActionTarget:
			return "this skill's target";
		case LocationKey.ActionList:
			return `${entityName(location.ownerId)}'s actions`;
		case LocationKey.ActionOrder: {
			const id = state.tabData[location.tab]?.actionOrder[location.index] as DollId | SummonId | undefined;
			return id ? `${entityName(id)} from the action order` : "the action order entry";
		}
		case LocationKey.SummonPosition: {
			const position = state.tabData[location.tab]?.summonPositions[location.index] as
				| SaveV9TabData["summonPositions"][number]
				| undefined;
			return position ? `${entityName(position.id)} from the map` : "the summon from the map";
		}
		case LocationKey.DollPosition:
			return `${entityName(location.dollId)} from the map`;
		case LocationKey.Buff:
			return "the buff";
		case LocationKey.DollKey:
			return isKnownKeyId(location.keyId) ? keyName(location.keyId) : "the key";
		case LocationKey.Timeline:
		case LocationKey.Map:
		case LocationKey.Doll:
		case LocationKey.DollWeapon:
			return "the entry";
	}
}

const PLURAL_TARGETS: Partial<Record<string, string>> = {
	"this skill use": "skill uses",
	"this skill's target": "skill targets",
};

/** `in setup`, `on turn 2`, or `in setup and on turns 1, 3 and 4`. */
function describeTurns(tabs: number[]): string {
	const turns = tabs.filter((tab) => tab > 0);
	const parts = tabs.includes(0) ? ["in setup"] : [];
	if (turns.length) parts.push(`on ${turns.length === 1 ? "turn" : "turns"} ${listText(turns.map(String))}`);
	return listText(parts);
}

function listText(items: string[]): string {
	return items.length > 1 ? `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}` : (items[0] ?? "");
}

/** Button label for removing every entry at `locations`, e.g. `Remove Self Hologram's actions on turns 1, 2 and 3`. */
export function describeRemoval(locations: SaveLocation[]): string {
	// several skill uses read as `2 skill uses`; other entries are already one per turn (named by the turn list)
	const counts = new Map<string, number>();
	for (const location of locations) {
		const target = removalTarget(location);
		counts.set(target, (counts.get(target) ?? 0) + 1);
	}
	const targets = [...counts].map(([target, count]) =>
		count > 1 && PLURAL_TARGETS[target] ? `${count} ${PLURAL_TARGETS[target]}` : target
	);
	const tabs = [...new Set(locations.flatMap((location) => ("tab" in location ? [location.tab] : [])))].sort((a, b) => a - b);
	return `Remove ${listText(targets)}${tabs.length ? ` ${describeTurns(tabs)}` : ""}`;
}

/** Locations `applyToGroup(group.message, removeEntry)` would remove: every error in the group that offers removal. */
export function groupRemovalLocations(group: ErrorGroup): SaveLocation[] {
	return group.errors.flatMap((error) => error.fixes.filter((fix) => fix.kind === FixKey.RemoveEntry).map((fix) => fix.location));
}

/** Edits one doll's loadout through `changeSelectedDolls`, which moves summon and skill ids onto the new loadout. */
function editLoadout(dollId: DollId, edit: (sd: SaveV9SelectedDoll, team: SaveV9SelectedDoll[]) => boolean): boolean {
	const team = state.selectedDolls.map((sd) => ({ ...sd, keys: [...sd.keys] }));
	const sd = team.find((d) => d.id === dollId);
	if (!sd || !edit(sd, team)) return false;
	changeSelectedDolls(team);
	return true;
}

function equipKey(sd: SaveV9SelectedDoll, keyId: KeyId): boolean {
	if (sd.keys.includes(keyId)) return false;
	const type = getKeyById(keyId).type;
	let index = sd.keys.findIndex((slot, i) => slot === "" && KEY_SLOTS[i] === type);
	if (index === -1) index = sd.keys.findIndex((slot) => slot === "");
	if (index === -1) {
		if (sd.keys.length >= KEY_SLOTS.length) return false;
		index = sd.keys.length;
	}
	sd.keys[index] = keyId;
	return true;
}

function unequipKey(sd: SaveV9SelectedDoll, keyId: KeyId): boolean {
	// the last copy, so a key equipped twice keeps its first slot
	const index = sd.keys.lastIndexOf(keyId);
	if (index === -1) return false;
	sd.keys[index] = "";
	return true;
}

/** Edits one turn's data; `edit` returns whether it changed anything. */
function editTab(tabIndex: number, edit: (tab: SaveV9TabData) => boolean): boolean {
	let changed = false;
	setState(
		produce((s) => {
			const tab = s.tabData[tabIndex] as SaveV9TabData | undefined;
			if (tab) changed = edit(tab);
		})
	);
	return changed;
}

function replaceId(location: SaveLocation, from: SkillId | SummonId, to: SkillId | SummonId): boolean {
	if (!("tab" in location)) return false;
	return editTab(location.tab, (tab) => {
		switch (location.kind) {
			case LocationKey.Action: {
				const action = tab.actions[location.ownerId]?.[location.index] as (typeof tab.actions)[string][number] | undefined;
				if (action?.[0] !== from) return false;
				action[0] = to as SkillId;
				return true;
			}
			case LocationKey.ActionTarget: {
				const action = tab.actions[location.ownerId]?.[location.index] as (typeof tab.actions)[string][number] | undefined;
				if (action?.[1] !== from) return false;
				action[1] = to as DollId | SummonId;
				return true;
			}
			case LocationKey.SummonPosition: {
				const position = tab.summonPositions[location.index] as (typeof tab.summonPositions)[number] | undefined;
				if (position?.id !== from) return false;
				position.id = to as SummonId;
				return true;
			}
			case LocationKey.ActionOrder:
				if (tab.actionOrder[location.index] !== from) return false;
				tab.actionOrder[location.index] = to as DollId | SummonId;
				return true;
			case LocationKey.ActionList: {
				const actions = tab.actions[from] as (typeof tab.actions)[string] | undefined;
				if (!actions?.length) return false;
				tab.actions[to] = [...(tab.actions[to] ?? []), ...actions];
				// eslint-disable-next-line @typescript-eslint/no-dynamic-delete
				delete tab.actions[from];
				return true;
			}
			default:
				return false;
		}
	});
}

function removeEntry(location: SaveLocation): boolean {
	switch (location.kind) {
		case LocationKey.Buff: {
			if (!state.buffs.includes(location.buffId)) return false;
			setState("buffs", (buffs) => buffs.filter((buffId) => buffId !== location.buffId));
			return true;
		}
		case LocationKey.DollKey:
			return editLoadout(location.dollId, (sd) => unequipKey(sd, location.keyId));
		case LocationKey.Timeline:
		case LocationKey.Map:
		case LocationKey.Doll:
		case LocationKey.DollWeapon:
			return false;
	}
	return editTab(location.tab, (tab) => {
		switch (location.kind) {
			case LocationKey.Action: {
				const actions = tab.actions[location.ownerId] as (typeof tab.actions)[string] | undefined;
				if (!actions || location.index >= actions.length) return false;
				actions.splice(location.index, 1);
				return true;
			}
			case LocationKey.ActionTarget: {
				const action = tab.actions[location.ownerId]?.[location.index] as (typeof tab.actions)[string][number] | undefined;
				if (action?.[1] === undefined) return false;
				tab.actions[location.ownerId][location.index] = [action[0]];
				return true;
			}
			case LocationKey.ActionList: {
				if (!tab.actions[location.ownerId]?.length) return false;
				tab.actions[location.ownerId] = [];
				return true;
			}
			case LocationKey.ActionOrder: {
				if (location.index >= tab.actionOrder.length) return false;
				tab.actionOrder.splice(location.index, 1);
				return true;
			}
			case LocationKey.SummonPosition: {
				if (location.index >= tab.summonPositions.length) return false;
				tab.summonPositions.splice(location.index, 1);
				return true;
			}
			case LocationKey.DollPosition: {
				const position = tab.dollPositions[location.dollId] as (typeof tab.dollPositions)[DollId] | undefined;
				if (!position || (position.x === -1 && position.y === -1)) return false;
				tab.dollPositions[location.dollId] = { x: -1, y: -1 };
				return true;
			}
		}
	});
}

/**
 * Performs one fix on the store and returns whether anything changed. Synchronous: call `finishFixes()` after one
 * fix or a batch to refresh the loadout editor, action order, images and saved copy.
 */
export function applySaveFix(fix: SaveFix): boolean {
	switch (fix.kind) {
		case FixKey.EquipKey:
			return isKnownKeyId(fix.keyId) && editLoadout(fix.dollId, (sd) => equipKey(sd, fix.keyId));
		case FixKey.UnequipKey:
			return editLoadout(fix.dollId, (sd) => unequipKey(sd, fix.keyId));
		case FixKey.SetFortification:
			return editLoadout(fix.dollId, (sd) => {
				if (sd.fortification === fix.fortification) return false;
				sd.fortification = fix.fortification;
				return true;
			});
		case FixKey.SetWeapon:
			return editLoadout(fix.dollId, (sd) => {
				if (sd.gun === fix.weaponId) return false;
				sd.gun = fix.weaponId;
				return true;
			});
		case FixKey.SetRemolding:
			return editLoadout(fix.dollId, (sd) => {
				if (sd.remoldingLvl === fix.level) return false;
				sd.remoldingLvl = fix.level;
				return true;
			});
		case FixKey.SetBorrow:
			return editLoadout(fix.dollId, (sd, team) => {
				// only one doll can be borrowed, so borrowing this one clears the rest (even when it already is)
				const others = fix.borrow ? team.filter((other) => other !== sd && other.borrow) : [];
				if (sd.borrow === fix.borrow && !others.length) return false;
				for (const other of others) other.borrow = false;
				sd.borrow = fix.borrow;
				return true;
			});
		case FixKey.SelectDoll: {
			if (!canApplyFix(fix)) return false;
			changeSelectedDolls([...state.selectedDolls.map((sd) => ({ ...sd, keys: [...sd.keys] })), defaultLoadout(fix.dollId)]);
			return true;
		}
		case FixKey.ReplaceId:
			return replaceId(fix.location, fix.from, fix.to);
		case FixKey.RemoveEntry:
			return removeEntry(fix.location);
		case FixKey.SetMap:
			if (state.map === fix.map) return false;
			setState("map", fix.map);
			loadMap(fix.map);
			return true;
		case FixKey.ChooseTarget:
			// needs the user to pick; see openTargetPicker
			return false;
		case FixKey.CopyPosition: {
			if (!canApplyFix(fix)) return false;
			const id = fix.id;
			const placements = copiedPlacements(fix);
			if (hasPrefix(id, IdKey.Dolls)) {
				return editTab(fix.tab, (tab) => {
					tab.dollPositions[id] = { x: placements[0].x, y: placements[0].y };
					return true;
				});
			}
			// keeps each instance id, so the summon carries on from that turn rather than being a new one
			const fresh: string[] = [];
			const positions = placements.map((p) => {
				// an empty id counts as missing, so `??` wouldn't do
				const mapId = p.mapId !== undefined && p.mapId !== "" ? p.mapId : nextSummonInstanceId(state.tabData, fresh);
				fresh.push(mapId);
				return { id, mapId, x: p.x, y: p.y };
			});
			return editTab(fix.tab, (tab) => {
				tab.summonPositions.push(...positions);
				return true;
			});
		}
		case FixKey.PlaceAt: {
			if (!canApplyFix(fix)) return false;
			const id = fix.id;
			if (hasPrefix(id, IdKey.Dolls)) {
				return editTab(fix.tab, (tab) => {
					tab.dollPositions[id] = { x: fix.x, y: fix.y };
					return true;
				});
			}
			// a summon that was on the map earlier keeps that instance, so it carries on rather than being a new one
			const mapId = earlierInstanceId(id, fix.tab) ?? nextSummonInstanceId(state.tabData);
			return editTab(fix.tab, (tab) => {
				tab.summonPositions.push({ id, mapId, x: fix.x, y: fix.y });
				return true;
			});
		}
		case FixKey.KeepOnTile: {
			const { keep } = fix;
			const onTile = (p: { x: number; y: number }) => p.x === fix.x && p.y === fix.y;
			return editTab(fix.tab, (tab) => {
				let changed = false;
				// everyone else on the tile goes off the map that turn, the same as removing each of them
				for (const [key, position] of Object.entries(tab.dollPositions)) {
					const dollId = key as DollId;
					if (!onTile(position) || (keep.kind === LocationKey.DollPosition && keep.dollId === dollId)) continue;
					tab.dollPositions[dollId] = { x: -1, y: -1 };
					changed = true;
				}
				const kept = tab.summonPositions.filter(
					(p, index) => !onTile(p) || (keep.kind === LocationKey.SummonPosition && keep.index === index)
				);
				if (kept.length !== tab.summonPositions.length) {
					tab.summonPositions = kept;
					changed = true;
				}
				return changed;
			});
		}
	}
}

/** The instance id of the summon's placement on the closest earlier turn it was on the map, if any. */
function earlierInstanceId(id: SummonId, tab: number): string | undefined {
	const base = summonBaseIdOf(id);
	for (let fromTab = tab - 1; fromTab >= 0; fromTab--) {
		const placement = state.tabData[fromTab].summonPositions.find((p) => summonBaseIdOf(p.id) === base && p.mapId);
		if (placement) return placement.mapId;
	}
	return undefined;
}

/** Opens the target modal to replace the target of the action at `location`, limited to teammates on the map that turn. */
export function openTargetPicker(location: Extract<SaveLocation, { kind: "action" }>) {
	const action = state.tabData[location.tab]?.actions[location.ownerId]?.[location.index] as SaveV9Action | undefined;
	if (!action) return;
	setTargetDollId(location.ownerId);
	setTargetSkillId(action[0]);
	setRetargetAction({ tab: location.tab, ownerId: location.ownerId, index: location.index });
	setShowTargetModal(true);
}

/** The same tail as `updateSelectedDolls`, run once after any number of fixes. */
export async function finishFixes() {
	setupTempSelectedDolls();
	for (let i = 0; i < 8; i++) defaultActionOrder(i);
	await preloadCanvasImages();
	saveToLocalStorage();
}

const isLoadoutRequirement = (fix: SaveFix) => fix.kind === FixKey.EquipKey || fix.kind === FixKey.SetFortification;

/**
 * The fixes "Fix all" applies for this error: every key/fortification it needs (they only help together), or else
 * the first other loadout fix, such as using the version of the skill the loadout has. Null when none can be applied.
 */
export function autoFixesFor(error: SaveError): SaveFix[] | null {
	const requirements = error.fixes.filter(isLoadoutRequirement);
	if (requirements.length && requirements.every(canApplyFix)) return requirements;
	const fix = error.fixes.find((f) => !isLoadoutRequirement(f) && isAutoFix(f) && canApplyFix(f));
	return fix ? [fix] : null;
}

/** What "Fix all" would apply for this group, each distinct fix once (see `fixKey`); empty when it's left alone. */
export function groupAutoFixes(group: ErrorGroup): SaveFix[] {
	const fixes = new Map<string, SaveFix>();
	for (const error of group.errors) {
		for (const fix of autoFixesFor(error) ?? []) fixes.set(fixKey(fix), fix);
	}
	return [...fixes.values()];
}

/**
 * Re-validates after every step, since a fix can move indices or make another fix unnecessary (once a doll is V4, a
 * V2 requirement is gone). A step that changes nothing isn't picked again. Returns how many fixes changed the timeline.
 */
function runFixes(pick: (error: SaveError) => SaveFix[] | null): number {
	const stuck = new Set<string>();
	let applied = 0;
	for (let step = 0; step < MAX_FIX_STEPS; step++) {
		let batch: SaveFix[] | null = null;
		let batchKey = "";
		for (const error of validateSave(state)) {
			const fixes = pick(error);
			if (!fixes) continue;
			const key = JSON.stringify(fixes);
			if (stuck.has(key)) continue;
			batch = fixes;
			batchKey = key;
			break;
		}
		if (!batch) break;
		let changed = 0;
		for (const fix of batch) if (applySaveFix(fix)) changed++;
		if (!changed) stuck.add(batchKey);
		applied += changed;
	}
	return applied;
}

/** Applies every loadout fix it can; problems that need removing work, adding a doll or another map are left. */
export async function fixAll(): Promise<number> {
	const applied = runFixes(autoFixesFor);
	if (applied) await finishFixes();
	return applied;
}

function sameFix(a: SaveFix, b: SaveFix): boolean {
	return fixKey(a) === fixKey(b);
}

/** Applies `fix` to every error with this message, e.g. "Remove" for every turn an owner's actions are invalid on. */
export async function applyToGroup(message: string, fix: SaveFix): Promise<number> {
	const applied = runFixes((error) => {
		if (error.message !== message) return null;
		const match = error.fixes.find((f) => sameFix(f, fix) && canApplyFix(f));
		return match ? [match] : null;
	});
	if (applied) await finishFixes();
	return applied;
}
