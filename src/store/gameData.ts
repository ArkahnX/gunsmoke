import { produce } from "solid-js/store";
import { endTurnSkill, getNotations, getNotationSlot, localState, setLocalState, skillOrder, state } from "./appState";
import {
	Attachment,
	AttachmentId,
	Buff,
	BuffId,
	CombinedAttachments,
	CombinedBuffs,
	CombinedDolls,
	CombinedEnemies,
	CombinedKeys,
	CombinedRemolding,
	CombinedSeasons,
	CombinedWeapons,
	Doll,
	DollId,
	Enemy,
	EnemyId,
	Key,
	KeyId,
	Remolding,
	RemoldingId,
	Season,
	SeasonId,
	Skill,
	SkillId,
	Summon,
	SummonId,
	Weapon,
	WeaponId,
} from "../../gfl2-data/types";
import { GunType, IdKey, KeyType, Rarity, SkillSelect, SkillType } from "../../gfl2-data/enums";
import { applyDollFortification } from "./fortification";
import { currentChain, log, logScope } from "../log";
import { SaveV9SelectedDoll } from "../types/saves";
import { V9_END_TURN_SKILL_ID } from "../types/constants";
import { isPlaced } from "./placement";

type EntityOf<T> = T extends DollId
	? Doll
	: T extends SummonId
		? Summon
		: T extends EnemyId
			? Enemy
			: T extends KeyId
				? Key
				: T extends AttachmentId
					? Attachment
					: T extends BuffId
						? Buff
						: T extends RemoldingId
							? Remolding
							: T extends SeasonId
								? Season
								: T extends WeaponId
									? Weapon
									: T extends SkillId
										? Skill
										: never;
type EntityId = DollId | SummonId | EnemyId;

export const combinedDolls: CombinedDolls = { data: {} };
export const combinedBuffs: CombinedBuffs = { data: {} };
export const combinedAttachments: CombinedAttachments = { data: {} };
export const combinedEnemies: CombinedEnemies = { data: {} };
export const combinedKeys: CombinedKeys = { data: {} };
export const combinedRemoldingStats: CombinedRemolding = { data: {} };
export const combinedSeasons: CombinedSeasons = { data: {} };
export const combinedWeapons: CombinedWeapons = { data: {} };
const summonIdToDollId = new Map<SummonId, { id: DollId; fortification: number; keyId?: KeyId }>();
const skillIdToEntityId = new Map<SkillId, { id: DollId | SummonId; fortification: number; keyId: KeyId | undefined }>();
const fixedKeyIdToDollId = new Map<KeyId, DollId>();
const dollIdToWeaponId = new Map<DollId, WeaponId>();
const defaultWeaponsByType = new Map<GunType, WeaponId>();
/** Any tier/key-replacement id -> the base id of its family (base ids map to themselves). */
const summonBaseId = new Map<SummonId, SummonId>();
const skillBaseId = new Map<SkillId, SkillId>();

/** What must be true on the owning doll for a summon/skill family to exist at all. Keyed by base id. */
export interface Requirement {
	/** Doll for summons; doll or base summon id for skills */
	ownerId: DollId | SummonId;
	name: string;
	requiresKey?: KeyId | undefined;
	minFortification?: number | undefined;
}
const summonRequirements = new Map<SummonId, Requirement>();
/** Base ids of summons that are controllable in at least one variant (base, fortification tier or key replacement). */
/** Base summon id -> the cheapest loadout that makes it controllable; absent for summons that are never playable. */
const playableRequirements = new Map<SummonId, PlayableRequirement>();

export interface PlayableRequirement {
	keys: KeyId[];
	minFortification?: number | undefined;
}
const skillRequirements = new Map<SkillId, Requirement>();
/** Log chain each lookup entry was last set from, so an overwrite can report where the old value came from. */
const mappedFrom = new Map<string, ReturnType<typeof currentChain>>();

function setMapped<K extends string, V>(map: Map<K, V>, mapName: string, key: K, value: V) {
	const source = `${mapName}:${key}`;
	const existing = map.get(key);
	if (existing !== undefined && JSON.stringify(existing) !== JSON.stringify(value)) {
		log.warn(`${mapName} overwriting ${key}`, { previous: existing, previousChain: mappedFrom.get(source), next: value });
	}
	map.set(key, value);
	mappedFrom.set(source, currentChain());
}

let CURRENT_SEASON: SeasonId = `${IdKey.Seasons}0`;

export function mapDollIdToWeaponId(weapon: Weapon) {
	if (weapon.dollId) dollIdToWeaponId.set(weapon.dollId, weapon.id);
}

export function mapDefaultWeaponTypes(weapon: Weapon) {
	if (defaultWeaponsByType.has(weapon.gunType)) return;
	if (weapon.rarity === Rarity.Elite && !weapon.dollId) {
		defaultWeaponsByType.set(weapon.gunType, weapon.id);
	}
}

/** First variant (base, then fortification levels, then key replacements) that is controllable, and what it needs. */
function findPlayableRequirement(summon: Summon): PlayableRequirement | undefined {
	const withKey = (key?: KeyId) => [summon.requiresKey, key].filter((k): k is KeyId => k !== undefined);
	const firstLevel = (levels: Summon["levels"]) =>
		Object.entries(levels ?? {})
			.filter(([, level]) => level.controllable)
			.map(([n]) => Number(n))
			.sort((a, b) => a - b)[0];
	if (summon.controllable) return { keys: withKey() };
	const level = firstLevel(summon.levels);
	if (level !== undefined) return { keys: withKey(), minFortification: level };
	for (const [key, replacement] of Object.entries(summon.replacedBy ?? {}) as [KeyId, Omit<Summon, "replacedBy">][]) {
		if (replacement.controllable) return { keys: withKey(key) };
		const replacementLevel = firstLevel(replacement.levels);
		if (replacementLevel !== undefined) return { keys: withKey(key), minFortification: replacementLevel };
	}
	return undefined;
}

export function mapSummonsToDoll(doll: Doll) {
	using _scope = logScope(`mapSummonsToDoll ${doll.id}`);
	for (const summon of doll.summons) {
		using _summonScope = logScope(`summon ${summon.id}`);
		setMapped(summonIdToDollId, "summonIdToDollId", summon.id, { id: doll.id, fortification: 0 });
		summonBaseId.set(summon.id, summon.id);
		summonRequirements.set(summon.id, { ownerId: doll.id, name: summon.name, requiresKey: summon.requiresKey });
		const playable = findPlayableRequirement(summon);
		if (playable) playableRequirements.set(summon.id, playable);
		if (summon.levels) {
			for (const [levelId, level] of Object.entries(summon.levels)) {
				if (level.id) {
					summonBaseId.set(level.id, summon.id);
					setMapped(summonIdToDollId, "summonIdToDollId", level.id, { id: doll.id, fortification: Number(levelId) });
				}
			}
		}
		if (summon.replacedBy) {
			for (const [keyId, replacement] of Object.entries(summon.replacedBy) as [KeyId, Omit<Summon, "replacedBy">][]) {
				using _replacementScope = logScope(`replacedBy ${keyId}`);
				if (replacement.id) {
					summonBaseId.set(replacement.id, summon.id);
					setMapped(summonIdToDollId, "summonIdToDollId", replacement.id, { id: doll.id, fortification: 0, keyId });
				}
				if (replacement.levels) {
					for (const [levelId, level] of Object.entries(replacement.levels)) {
						if (level.id) {
							summonBaseId.set(level.id, summon.id);
							setMapped(summonIdToDollId, "summonIdToDollId", level.id, {
								id: doll.id,
								fortification: Number(levelId),
								keyId,
							});
						}
					}
				}
			}
		}
	}
}

export function mapFixedKeysToDoll(doll: Doll) {
	for (const key of doll.keys) {
		if (key.type === KeyType.FixedKey || key.type === KeyType.ExpansionKey) {
			fixedKeyIdToDollId.set(key.id, doll.id);
		}
	}
}

export function mapSkillsToEntity(entity: Doll | Summon) {
	using _scope = logScope(`mapSkillsToEntity ${entity.id}`);
	mapSkillIds(entity.skills, entity.id);
	if ("levels" in entity) {
		for (const [levelId, level] of Object.entries(entity.levels)) {
			using _levelScope = logScope(`level ${levelId}`);
			if (level.skills) {
				mapSkillIds(level.skills, entity.id, Number(levelId));
			}
		}
	}
	if ("replacedBy" in entity) {
		for (const [keyId, replacement] of Object.entries(entity.replacedBy) as [KeyId, Omit<Summon, "replacedBy">][]) {
			using _replacementScope = logScope(`replacedBy ${keyId}`);
			if (replacement.skills) {
				mapSkillIds(replacement.skills, entity.id, 0, keyId);
			}
			if ("levels" in replacement) {
				for (const [levelId, level] of Object.entries(replacement.levels)) {
					using _levelScope = logScope(`level ${levelId}`);
					if (level.skills) {
						mapSkillIds(level.skills, entity.id, Number(levelId), keyId);
					}
				}
			}
		}
	}
	if ("summons" in entity) {
		for (const summon of entity.summons) {
			mapSkillsToEntity(summon);
		}
	}
}

export function mapSkillIds(skills: Skill[], id: SummonId | DollId, baseFortification = 0, keyId?: KeyId) {
	for (const skill of skills) {
		using _skillScope = logScope(`skill ${skill.id}`);
		setMapped(skillIdToEntityId, "skillIdToEntityId", skill.id, { id, fortification: baseFortification, keyId });
		skillBaseId.set(skill.id, skill.id);
		// baseFortification/keyId are set when the skill is added by an entity's fortification level or key replacement
		skillRequirements.set(skill.id, {
			ownerId: id,
			name: skill.name,
			requiresKey: skill.requiresKey ?? keyId,
			minFortification: baseFortification || undefined,
		});
		if (skill.levels) {
			for (const [levelId, level] of Object.entries(skill.levels)) {
				if (level.id) {
					skillBaseId.set(level.id, skill.id);
					setMapped(skillIdToEntityId, "skillIdToEntityId", level.id, { id, fortification: Number(levelId), keyId });
				}
			}
		}
		if (skill.replacedBy) {
			for (const [replacementKeyId, replacement] of Object.entries(skill.replacedBy) as [KeyId, Skill][]) {
				using _replacementScope = logScope(`replacedBy ${replacementKeyId}`);
				if (replacement.id) {
					skillBaseId.set(replacement.id, skill.id);
					setMapped(skillIdToEntityId, "skillIdToEntityId", replacement.id, {
						id,
						fortification: baseFortification,
						keyId: replacementKeyId,
					});
				}
				if (replacement.levels) {
					for (const [levelId, level] of Object.entries(replacement.levels)) {
						if (level.id) {
							skillBaseId.set(level.id, skill.id);
							setMapped(skillIdToEntityId, "skillIdToEntityId", level.id, {
								id,
								fortification: Number(levelId),
								keyId: replacementKeyId,
							});
						}
					}
				}
			}
		}
	}
}

export function summonBaseIdOf(id: SummonId): SummonId {
	return summonBaseId.get(id) ?? id;
}

export function skillBaseIdOf(id: SkillId): SkillId {
	return skillBaseId.get(id) ?? id;
}

/** False for summons that are never controllable, whatever the owning doll's fortification and keys. */
export function isEverPlayable(id: SummonId): boolean {
	return playableRequirements.has(summonBaseIdOf(id));
}

/** What the owning doll needs for the summon to be controllable. Throws for summons that are never playable. */
export function getPlayableRequirement(id: SummonId): PlayableRequirement {
	const requirement = playableRequirements.get(summonBaseIdOf(id));
	if (!requirement) throw new Error(`Summon ${id} is never playable`);
	return requirement;
}

/** The key the owner must equip for the summon to be on the map at all; undefined when it can be fielded as is. */
export function missingSummonKey(summon: Summon, owner: SaveV9SelectedDoll): KeyId | undefined {
	return summon.requiresKey && !owner.keys.includes(summon.requiresKey) ? summon.requiresKey : undefined;
}

/** Whether the summon, as resolved for its owner's current loadout, can act. */
export function isSummonUnlocked(summon: Summon, owner: SaveV9SelectedDoll): boolean {
	return !!summon.controllable && missingSummonKey(summon, owner) === undefined;
}

export function isKnownBuffId(id: string): id is BuffId {
	return id in combinedBuffs.data;
}

export function isKnownWeaponId(id: string): id is WeaponId {
	return id in combinedWeapons.data;
}

export function isKnownKeyId(id: string): id is KeyId {
	return id in combinedKeys.data || fixedKeyIdToDollId.has(id as KeyId);
}

/** The doll a fixed or expansion key belongs to; undefined for common and affinity keys, which any doll can equip. */
export function getKeyOwnerId(id: KeyId): DollId | undefined {
	if (!isKnownKeyId(id)) throw new Error(`Key ${String(id)} not found`);
	return fixedKeyIdToDollId.get(id);
}

export function isKnownSummonId(id: string): id is SummonId {
	return summonIdToDollId.has(id as SummonId);
}

export function isKnownSkillId(id: string): id is SkillId {
	return id === V9_END_TURN_SKILL_ID || skillIdToEntityId.has(id as SkillId);
}

export function getSummonOwnerId(id: SummonId): DollId {
	const data = summonIdToDollId.get(id);
	if (!data) throw new Error(`Summon ${id} not found`);
	return data.id;
}

export function getSummonRequirement(id: SummonId): Requirement {
	const requirement = summonRequirements.get(summonBaseIdOf(id));
	if (!requirement) throw new Error(`Requirement for summon ${id} not found`);
	return requirement;
}

/** The fortification and key a specific skill id (base, tier or key replacement) belongs to. */
export function getSkillTier(id: SkillId): { fortification: number; keyId: KeyId | undefined } {
	const data = skillIdToEntityId.get(id);
	if (!data) throw new Error(`Skill ${id} not found`);
	return { fortification: data.fortification, keyId: data.keyId };
}

export function getSummonTier(id: SummonId): { fortification: number; keyId: KeyId | undefined } {
	const data = summonIdToDollId.get(id);
	if (!data) throw new Error(`Summon ${id} not found`);
	return { fortification: data.fortification, keyId: data.keyId };
}

export function getSkillRequirement(id: SkillId): Requirement {
	const requirement = skillRequirements.get(skillBaseIdOf(id));
	if (!requirement) throw new Error(`Requirement for skill ${id} not found`);
	return requirement;
}

/** Exact id first, then any member of the same family (another fortification tier or key replacement). */
function matchFamily<T extends { id: string }>(items: T[], id: string, baseOf: (id: string) => string): T | undefined {
	return items.find((item) => item.id === id) ?? items.find((item) => baseOf(item.id) === baseOf(id));
}

/** Whether the doll's current loadout has a summon in the same family as `id`. */
export function hasSummonFamily(id: SummonId, doll: Doll): boolean {
	return matchFamily(doll.summons, id, (i) => summonBaseIdOf(i as SummonId)) !== undefined;
}

/** Whether the entity's current loadout has a skill in the same family as `id`. */
export function hasSkillFamily(id: SkillId, entity: Doll | Summon): boolean {
	return matchFamily(entity.skills, id, (i) => skillBaseIdOf(i as SkillId)) !== undefined;
}

/** The summon on the doll's current loadout in the same family as `id`. */
export function resolveSummon(id: SummonId, doll: Doll): Summon {
	const summon = matchFamily(doll.summons, id, (i) => summonBaseIdOf(i as SummonId));
	if (!summon) throw new Error(`Summon ${id} not found on doll ${doll.id}`);
	return summon;
}

/** The skill on the entity's current loadout in the same family as `id`. */
export function resolveSkill(id: SkillId, entity: Doll | Summon): Skill {
	const skill = matchFamily(entity.skills, id, (i) => skillBaseIdOf(i as SkillId));
	if (!skill) throw new Error(`Skill ${id} not found on entity ${entity.id}`);
	return skill;
}

export function getDollByDollOrSummon(dollOrSummon: Doll | Summon): Doll {
	if (hasPrefix(dollOrSummon.id, IdKey.Dolls)) {
		return dollOrSummon as Doll;
	} else if (hasPrefix(dollOrSummon.id, IdKey.Summons)) {
		const data = summonIdToDollId.get(dollOrSummon.id);
		if (!data) throw new Error(`Summon ${dollOrSummon.id} to doll reference not found`);
		const selectedDoll = state.selectedDolls.find((s) => s.id === data.id);
		if (!selectedDoll) throw new Error(`Doll ${data.id} is not an actively selected doll`);
		return getSelectedDoll(selectedDoll);
	}
	throw new Error(`Invalid doll or summon id ${String(dollOrSummon.id)}`);
}

/** Whether the doll or summon is CN only: its doll is, or the key that brings the summon in or replaces it is. */
export function isUnreleased(target: Doll | Summon): boolean {
	if (getDollByDollOrSummon(target).unreleased) return true;
	if (!hasPrefix(target.id, IdKey.Summons)) return false;
	const keyIds = [getSummonRequirement(target.id).requiresKey, getSummonTier(target.id).keyId];
	return keyIds.some((keyId) => keyId !== undefined && getKeyById(keyId).unreleased === true);
}

/** A summon with no skills: it only stands on the map (e.g. Hologram - Mityl), so it never has actions. */
export function isInertSummon(target: Doll | Summon): boolean {
	return hasPrefix(target.id, IdKey.Summons) && target.skills.length === 0;
}

export function getDollById(id: DollId): Doll {
	return applyDollFortification({ id, fortification: 0, keys: [] });
}

/** `includeLocked` also returns skills that need an unequipped key or a higher fortification. */
export function getSelectedDoll(sd: SaveV9SelectedDoll, includeLocked = false): Doll {
	return applyDollFortification(sd, includeLocked);
}

export function getSelectedDollById(id: DollId): Doll {
	const selectedDoll = state.selectedDolls.find((s) => s.id === id);
	if (!selectedDoll) throw new Error(`Doll ${id} is not an actively selected doll`);
	return applyDollFortification(selectedDoll);
}

export function getDollChibiIconByWeapon(weapon: Weapon) {
	if (!weapon.dollId) return "";
	const doll = getDollById(weapon.dollId);
	return doll.icons.chibi;
}

export function getDollAvatarByKey(key: Key) {
	if (!key.dollId) return "";
	const doll = getDollById(key.dollId);
	return doll.icons.avatar;
}

export function getSummonById(id: SummonId): Summon {
	return resolveSummon(id, getSelectedDollById(getSummonOwnerId(id)));
}

/**
 * The summon's icon as that id looks (its fortification tier or key version), whether or not its owner is selected; ""
 * for an id the game data doesn't know.
 */
export function getSummonIcon(id: SummonId): string {
	const loadout = summonIdToDollId.get(id);
	if (!loadout) return "";
	const doll = applyDollFortification({
		id: loadout.id,
		fortification: loadout.fortification,
		keys: loadout.keyId ? [loadout.keyId] : [],
	});
	return matchFamily(doll.summons, id, (i) => summonBaseIdOf(i as SummonId))?.icon ?? "";
}

export function getSkillById(id: SkillId): Skill {
	if (id === V9_END_TURN_SKILL_ID) return endTurnSkill;
	const data = skillIdToEntityId.get(id);
	if (!data) throw new Error(`Skill ${id} not found`);
	return resolveSkill(id, getEntityById(data.id));
}

export function getFixedKeyById(id: KeyId): Key {
	const keyId = fixedKeyIdToDollId.get(id);
	if (!keyId) throw new Error(`Fixed key ${id} not found`);
	const doll = getDollById(keyId);
	const keys: Record<KeyId, Key> = {};
	for (const key of doll.keys) {
		keys[key.id] = key;
	}
	return keys[id];
}

export function getAttachmentById(id: AttachmentId): Attachment {
	if (!combinedAttachments.data[id]) throw new Error(`Attachment ${id} not found`);
	return combinedAttachments.data[id];
}

export function getBuffById(id: BuffId): Buff {
	if (!combinedBuffs.data[id]) throw new Error(`Buff ${id} not found`);
	return combinedBuffs.data[id];
}

export function getEnemyById(id: EnemyId): Enemy {
	if (!combinedEnemies.data[id]) throw new Error(`Enemy ${id} not found`);
	return combinedEnemies.data[id];
}

export function getSharedKeyById(id: KeyId): Key {
	if (!combinedKeys.data[id]) throw new Error(`Key ${id} not found`);
	return combinedKeys.data[id];
}

export function getKeyById(id: KeyId): Key {
	if (hasPrefix(id, IdKey.CommonKeys, IdKey.AffinityKeys)) {
		return getSharedKeyById(id);
	} else if (hasPrefix(id, IdKey.FixedKeys)) {
		return getFixedKeyById(id);
	} else {
		throw new Error(`${String(id)} is probably not a key`);
	}
}

export function hasExpansionKey(dollOrId: Doll | DollId) {
	const doll = typeof dollOrId === "string" ? getDollById(dollOrId) : dollOrId;
	for (const key of doll.keys) {
		if (key.type === KeyType.ExpansionKey) return true;
	}
	return false;
}

export function getRemoldingStatById(id: RemoldingId): Remolding {
	if (!combinedRemoldingStats.data[id]) throw new Error(`RemoldingStats ${id} not found`);
	return combinedRemoldingStats.data[id];
}

export function getSeasonById(id: SeasonId): Season {
	if (!combinedSeasons.data[id]) throw new Error(`Season ${id} not found`);
	return combinedSeasons.data[id];
}

export function getWeaponById(id: WeaponId): Weapon {
	if (!combinedWeapons.data[id]) throw new Error(`Weapon ${id} not found`);
	return combinedWeapons.data[id];
}

export function getWeaponByDollId(id: DollId): Weapon {
	const weaponId = dollIdToWeaponId.get(id);
	if (!weaponId) throw new Error(`Weapon for doll ${id} not found`);
	return getWeaponById(weaponId);
}

export function getDefaultWeaponByType(gunType: GunType): Weapon {
	const weaponId = defaultWeaponsByType.get(gunType);
	if (!weaponId) throw new Error(`Weapon for gun type ${gunType} not found`);
	return getWeaponById(weaponId);
}

export function hasPrefix<P extends IdKey>(id: string, ...prefixes: P[]): id is `${P}${string}` {
	return prefixes.some((prefix) => id.startsWith(prefix));
}

export function getEntityById<T extends EntityId>(id: T): EntityOf<T>;
export function getEntityById(id: EntityId): Doll | Summon | Enemy {
	if (hasPrefix(id, IdKey.Dolls)) {
		const selectedDoll = state.selectedDolls.find((s) => s.id === id);
		if (!selectedDoll) throw new Error(`Doll ${id} is not an actively selected doll`);
		return getSelectedDoll(selectedDoll);
	} else if (hasPrefix(id, IdKey.Summons)) {
		return getSummonById(id);
	} else if (hasPrefix(id, IdKey.Enemies)) {
		return getEnemyById(id);
	}
	throw new Error(`Entity ${String(id)} not found`);
}

export function getEntityBySkillId(id: SkillId) {
	const data = skillIdToEntityId.get(id);
	if (!data) throw new Error(`Entity for skill ${id} not found`);
	return getEntityById(data.id);
}

export function getEntityIdBySkillId(id: SkillId) {
	const data = skillIdToEntityId.get(id);
	if (!data) throw new Error(`Entity for skill ${id} not found`);
	// summon skills are indexed under the base summon id; return the id of the summon currently on the field
	return getEntityById(data.id).id;
}

export function getCurrentSeason() {
	return combinedSeasons.data[CURRENT_SEASON];
}

/** Manual skills in `skillOrder` order; skills of the same type keep their data order. */
export function getSortedUsableSkills(entity: Doll | Summon): Skill[] {
	const manual = entity.skills.filter((s) => s.manual);
	const unordered = manual.filter((s) => !skillOrder.includes(s.type));
	if (unordered.length > 0) {
		// const names = unordered.map((s) => `name: ${s.name} id: ${s.id} type: ${SkillTypeLabels[s.type]}`);
		throw new Error("Unable to match all skills to SkillOrder list");
	}
	return manual.sort((a, b) => skillOrder.indexOf(a.type) - skillOrder.indexOf(b.type));
}

export function getEntitiesByIdBatch(batchIds: (DollId | SummonId)[]) {
	const result: (Doll | Summon)[] = [];
	for (const id of batchIds) {
		if (hasPrefix(id, IdKey.Dolls)) {
			result.push(getSelectedDollById(id));
		} else if (hasPrefix(id, IdKey.Summons)) {
			result.push(getSummonById(id));
		} else {
			throw new Error(`Unknown ID ${String(id)} found in action order`);
		}
	}
	return result;
}

function getSelectedDollEntry(id: DollId): SaveV9SelectedDoll {
	const selectedDoll = state.selectedDolls.find((s) => s.id === id);
	if (!selectedDoll) throw new Error(`Doll ${id} is not an actively selected doll`);
	return selectedDoll;
}

/**
 * Entities for the action bar, in order. Summons that are never playable in any variant are always hidden. Otherwise
 * only what the dolls' keys and fortification allow is shown (a summon must be controllable and have its key), unless
 * `localState.alwaysDisplaySkills` is on, in which case locked summons and skills are shown too.
 */
export function getActionBarEntities(batchIds: (DollId | SummonId)[]): (Doll | Summon)[] {
	const showLocked = localState.alwaysDisplaySkills;
	const result: (Doll | Summon)[] = [];
	for (const id of batchIds) {
		if (hasPrefix(id, IdKey.Dolls)) {
			result.push(getSelectedDoll(getSelectedDollEntry(id), showLocked));
		} else if (hasPrefix(id, IdKey.Summons)) {
			const owner = getSelectedDollEntry(getSummonOwnerId(id));
			const summon = resolveSummon(id, getSelectedDoll(owner, showLocked));
			if (!isEverPlayable(summon.id)) continue;
			if (!showLocked && !isSummonUnlocked(summon, owner)) continue;
			result.push(summon);
		} else {
			throw new Error(`Unknown ID ${String(id)} found in action order`);
		}
	}
	return result;
}

export interface SetupSummon {
	summon: Summon;
	owner: SaveV9SelectedDoll;
	/** Set when the owner needs this key equipped before the summon can be on the map */
	missingKey: KeyId | undefined;
}

/** Every summon of the selected dolls, including ones a key would unlock (`missingKey` says which). */
export function getSummonsFromSelectedDolls(selectedDolls: SaveV9SelectedDoll[]): SetupSummon[] {
	const result: SetupSummon[] = [];
	for (const sd of selectedDolls) {
		const doll = getSelectedDoll(sd);
		for (const summon of doll.summons) {
			result.push({ summon, owner: sd, missingKey: missingSummonKey(summon, sd) });
		}
	}
	return result;
}

/** `excludeUnplaced` keeps only dolls and summons placed on `tab` (the current tab by default). */
export function getSelectedDollAndSummonInfo(
	excludeIds: (DollId | SummonId | null)[] = [],
	excludeUnplaced = false,
	tab = localState.currentTab
) {
	const dolls: (Doll | Summon)[] = [];
	for (const sd of state.selectedDolls) {
		const doll = getSelectedDoll(sd);
		const includeDoll = excludeUnplaced ? isPlaced(doll.id, tab) : true;
		if (!excludeIds.includes(sd.id) && includeDoll) {
			dolls.push(doll);
		}
		for (const summon of doll.summons) {
			const includeSummon = excludeUnplaced ? isPlaced(summon.id, tab) : true;
			const isSelectable = !summon.unselectable;
			if (!excludeIds.includes(summon.id) && includeSummon && isSelectable) {
				dolls.push(summon);
			}
		}
	}
	return dolls;
}

/** Teammates `ownerId`'s targeting skill can pick on `tab`: every other doll or summon placed on the map that turn. */
export function getTargetCandidates(ownerId: DollId | SummonId, tab: number) {
	return getSelectedDollAndSummonInfo([ownerId], true, tab);
}

/** Skills that pick an allied doll or summon, recorded with that target as the action's second entry. */
export function needsAllyTarget(skill: Skill): boolean {
	return skill.selects.includes(SkillSelect.Ally) || skill.selects.includes(SkillSelect.OtherAlliedDoll);
}

export function getSelectedDollNamesAndFortifications() {
	const dolls: string[] = [];
	const sorted = state.selectedDolls
		.map((sd) => {
			const doll = getSelectedDoll(sd);
			return { fortification: sd.fortification, name: doll.name, borrow: sd.borrow };
		})
		// borrowed doll first, then highest fortification
		.sort((a, b) => Number(b.borrow) - Number(a.borrow) || b.fortification - a.fortification || a.name.localeCompare(b.name));
	for (const sd of sorted) {
		dolls.push(`${sd.name} (V${sd.fortification})`);
	}
	return dolls;
}

export function sortBuffs(buffId1: BuffId, buffId2: BuffId) {
	// unknown buffs (reported by validateSave) sort last instead of throwing while saving
	const known1 = isKnownBuffId(buffId1);
	const known2 = isKnownBuffId(buffId2);
	if (!known1 || !known2) return Number(known2) - Number(known1);
	const buff1 = getBuffById(buffId1);
	const buff2 = getBuffById(buffId2);
	const season = getSeasonById(CURRENT_SEASON);
	const coreBuffId = season.buffId;
	const seasonalBuffIds = Object.keys(season.dailyBuffIds);
	return (
		Number(buffId2 === coreBuffId) - Number(buffId1 === coreBuffId) ||
		Number(seasonalBuffIds.includes(buffId1)) - Number(seasonalBuffIds.includes(buffId2)) ||
		seasonalBuffIds.indexOf(buffId1) - seasonalBuffIds.indexOf(buffId2) ||
		buff1.name.localeCompare(buff2.name)
	);
}

export function setSkillDisplay(skillType: SkillType, notationStyle: string) {
	const slot = getNotationSlot(skillType);
	const index = getNotations(skillType).indexOf(notationStyle);
	if (localState.skillDisplay[slot] === index) return;
	setLocalState(
		produce((s) => {
			s.skillDisplay[slot] = index;
		})
	);
}

export function getSkillDisplay(skillType: SkillType): string {
	return getNotations(skillType)[localState.skillDisplay[getNotationSlot(skillType)] ?? 0];
}

export async function loadGameData() {
	try {
		const res = await Promise.all([
			fetch("gfl2-data/attachments.json"),
			fetch("gfl2-data/buffs.json"),
			fetch("gfl2-data/dolls.json"),
			fetch("gfl2-data/enemies.json"),
			fetch("gfl2-data/keys.json"),
			fetch("gfl2-data/remoldingStats.json"),
			fetch("gfl2-data/seasons.json"),
			fetch("gfl2-data/weapons.json"),
		]);
		const attachments = (await res[0].json()) as CombinedAttachments;
		const buffs = (await res[1].json()) as CombinedBuffs;
		const dolls = (await res[2].json()) as CombinedDolls;
		const enemies = (await res[3].json()) as CombinedEnemies;
		const keys = (await res[4].json()) as CombinedKeys;
		const remoldingStats = (await res[5].json()) as CombinedRemolding;
		const seasons = (await res[6].json()) as CombinedSeasons;
		const weapons = (await res[7].json()) as CombinedWeapons;
		Object.assign(combinedAttachments.data, attachments.data);
		Object.assign(combinedBuffs.data, buffs.data);
		Object.assign(combinedDolls.data, dolls.data);
		Object.assign(combinedEnemies.data, enemies.data);
		Object.assign(combinedKeys.data, keys.data);
		Object.assign(combinedRemoldingStats.data, remoldingStats.data);
		Object.assign(combinedSeasons.data, seasons.data);
		Object.assign(combinedWeapons.data, weapons.data);

		// Current season is the unexpired season ending soonest; if all have expired, the most recently ended one
		const now = Date.now();
		let nearestEnd = Infinity;
		let latestEnd = -Infinity;
		let latestId = CURRENT_SEASON;
		for (const season of Object.values(combinedSeasons.data)) {
			const end = Date.parse(season.endTime);
			if (end > now && end < nearestEnd) {
				nearestEnd = end;
				CURRENT_SEASON = season.id;
			}
			if (end > latestEnd) {
				latestEnd = end;
				latestId = season.id;
			}
		}
		if (nearestEnd === Infinity) CURRENT_SEASON = latestId;

		for (const weapon of Object.values(combinedWeapons.data)) {
			mapDollIdToWeaponId(weapon);
			mapDefaultWeaponTypes(weapon);
		}

		for (const doll of Object.values(combinedDolls.data)) {
			mapSummonsToDoll(doll);
			mapFixedKeysToDoll(doll);
			mapSkillsToEntity(doll);
		}

		// for (const enemy of Object.values(combinedEnemies.data)) {
		// 	mapSkillsToEntity(enemy);
		// }
	} catch (e) {
		console.error(e);
	}
}
