import { Accessor, createMemo, createRoot } from "solid-js";
import { Doll, DollId, KeyId, Skill, SkillId, Summon, SummonId } from "../../gfl2-data/types";
import { GunTypeLabels, IdKey, KeyType, KeyTypeLabels, SkillSelectLabels, SkillType, SkillTypeLabels } from "../../gfl2-data/enums";
import { SaveV9, SaveV9TabData } from "../types/saves";
import { FORTIFICATION_LEVELS, KEY_SLOTS, REMOLDING_LEVELS, V9_END_TURN_SKILL_ID } from "../types/constants";
import { MapGrid, Position, TileType } from "../types";
import { state } from "./appState";
import { getDefaultMap, getMapByName, isKnownMap } from "../canvas/editorMap";
import { gridKey, isTileType } from "./mapGrid";
import { keyHolders, maxKeyHolders } from "./keys";
import {
	combinedDolls,
	getDollById,
	getKeyById,
	getKeyOwnerId,
	getWeaponById,
	getWeaponByDollId,
	hasExpansionKey,
	isKnownBuffId,
	isKnownKeyId,
	isKnownWeaponId,
	getSelectedDoll,
	getSkillRequirement,
	getSummonIcon,
	getSummonOwnerId,
	getSummonRequirement,
	hasPrefix,
	hasSkillFamily,
	hasSummonFamily,
	getPlayableRequirement,
	isEverPlayable,
	getSkillTier,
	isKnownSkillId,
	isSummonUnlocked,
	missingSummonKey,
	isKnownSummonId,
	needsAllyTarget,
	resolveSkill,
	resolveSummon,
	summonBaseIdOf,
} from "./gameData";
import {
	Context,
	EntityCheck,
	ErrorDetails,
	FixKey,
	LocationKey,
	PositionLocation,
	SaveError,
	SaveErrorCode,
	SaveFix,
	SaveLocation,
} from "../types/issues";

function dollName(id: DollId) {
	return getDollById(id).name;
}

/**
 * Key with its slot type, e.g. `Fixed Key "Mistress of Disguise"`, so it's clear what has to be equipped. Some dolls
 * have two keys of one type with the same name (Tololo's, Daiyan's and Ullrid's expansion keys); those get their
 * in-game number, e.g. `Expansion Key "Captured Starlight" Lv. 2`.
 */
export function keyName(id: KeyId) {
	const key = getKeyById(id);
	const ownerId = getKeyOwnerId(id);
	const sameName =
		ownerId && getDollById(ownerId).keys.some((other) => other.id !== id && other.type === key.type && other.name === key.name);
	return `${KeyTypeLabels[key.type]} "${key.name}"${sameName && key.number !== null ? ` Lv. ${key.number}` : ""}`;
}

/** Which version of a skill/summon an id is, e.g. `V2`, `Fixed Key "X"`, `V2 + Fixed Key "X"` or `base`. */
export function tierName(tier: { fortification: number; keyId: KeyId | undefined }): string {
	const parts = [tier.fortification ? `V${tier.fortification}` : "", tier.keyId ? keyName(tier.keyId) : ""].filter(Boolean);
	return parts.length ? parts.join(" + ") : "base";
}

/** `equip Fixed Key "X" and be at least V2`, the loadout changes a doll needs. */
function needsText(keys: KeyId[], fortification: number | undefined): string {
	const parts = keys.map((keyId) => `equip ${keyName(keyId)}`);
	if (fortification) parts.push(`be at least V${fortification}`);
	return parts.join(" and ");
}

/** Checks a doll/summon id against the selected dolls' current loadouts. */
function checkEntity(id: DollId | SummonId, location: SaveLocation, ctx: Context): EntityCheck {
	if (hasPrefix(id, IdKey.Dolls)) {
		const doll = ctx.resolved.get(id);
		if (doll) return { ok: true, entity: doll };
		return {
			ok: false,
			error: {
				code: SaveErrorCode.OwnerNotSelected,
				renderable: false,
				reason: `${dollName(id)} is not in the team`,
				fixes: [
					{ kind: FixKey.SelectDoll, dollId: id },
					{ kind: FixKey.RemoveEntry, location },
				],
			},
		};
	}
	if (!isKnownSummonId(id)) {
		return {
			ok: false,
			error: {
				code: SaveErrorCode.UnknownId,
				renderable: false,
				reason: `Unknown doll or summon "${String(id)}"`,
				fixes: [{ kind: FixKey.RemoveEntry, location }],
			},
		};
	}
	const requirement = getSummonRequirement(id);
	const ownerId = getSummonOwnerId(id);
	const doll = ctx.resolved.get(ownerId);
	if (!doll) {
		return {
			ok: false,
			error: {
				code: SaveErrorCode.OwnerNotSelected,
				renderable: false,
				reason: `${requirement.name} needs ${dollName(ownerId)}, who is not in the team`,
				fixes: [
					{ kind: FixKey.SelectDoll, dollId: ownerId },
					{ kind: FixKey.RemoveEntry, location },
				],
			},
		};
	}
	if (!hasSummonFamily(id, doll)) {
		// a summon that needs a key is missing from the loadout until that key is equipped
		const keyId = requirement.requiresKey;
		if (keyId && !ctx.selected.get(ownerId)?.keys.includes(keyId)) {
			return {
				ok: false,
				error: {
					code: SaveErrorCode.MissingKey,
					renderable: false,
					reason: `${requirement.name} needs ${doll.name} to ${needsText([keyId], undefined)}`,
					fixes: [
						{ kind: FixKey.EquipKey, dollId: ownerId, keyId },
						{ kind: FixKey.RemoveEntry, location },
					],
				},
			};
		}
		return {
			ok: false,
			error: {
				code: SaveErrorCode.UnknownId,
				renderable: false,
				reason: `${doll.name} has no summon "${requirement.name}"`,
				fixes: [{ kind: FixKey.RemoveEntry, location }],
			},
		};
	}
	const summon = resolveSummon(id, doll);
	if (summon.id !== id) {
		return {
			ok: false,
			resolved: summon,
			error: {
				code: SaveErrorCode.StaleTier,
				renderable: true,
				reason: `${summon.name} doesn't match ${doll.name}'s current loadout`,
				fixes: [{ kind: FixKey.ReplaceId, location, from: id, to: summon.id }],
			},
		};
	}
	return { ok: true, entity: summon };
}

/** A summon that uses skills must be controllable with its owner's loadout; placing it without acting is fine. */
function checkSummonUnlocked(id: SummonId, summon: Summon, location: SaveLocation, ctx: Context): ErrorDetails | null {
	const dollId = getSummonOwnerId(id);
	const sd = ctx.selected.get(dollId);
	if (!sd || isSummonUnlocked(summon, sd)) return null;
	const needs = getPlayableRequirement(id);
	const missingKeys = needs.keys.filter((keyId) => !sd.keys.includes(keyId));
	const missingFortification = needs.minFortification && sd.fortification < needs.minFortification ? needs.minFortification : undefined;
	const fixes: SaveFix[] = missingKeys.map((keyId) => ({ kind: FixKey.EquipKey, dollId, keyId }));
	if (missingFortification) fixes.push({ kind: FixKey.SetFortification, dollId, fortification: missingFortification });
	const reason = fixes.length
		? `${summon.name} can't be controlled: ${dollName(dollId)} needs to ${needsText(missingKeys, missingFortification)}`
		: `${summon.name} can't be controlled with ${dollName(dollId)}'s current loadout`;
	return { code: SaveErrorCode.NotPlayable, renderable: true, reason, fixes: [...fixes, { kind: FixKey.RemoveEntry, location }] };
}

/** A summon on the map needs its key equipped to be there at all (e.g. Hologram - Mityl, Fixed-Point Satellite). */
function checkSummonFielded(id: SummonId, summon: Summon, location: SaveLocation, ctx: Context): ErrorDetails | null {
	const dollId = getSummonOwnerId(id);
	const sd = ctx.selected.get(dollId);
	const keyId = sd ? missingSummonKey(summon, sd) : undefined;
	if (!keyId) return null;
	return {
		code: SaveErrorCode.MissingKey,
		renderable: true,
		reason: `${summon.name} is on the map, but needs ${dollName(dollId)} to ${needsText([keyId], undefined)}`,
		fixes: [
			{ kind: FixKey.EquipKey, dollId, keyId },
			{ kind: FixKey.RemoveEntry, location },
		],
	};
}

function ownerDollId(entity: Doll | Summon): DollId {
	return hasPrefix(entity.id, IdKey.Dolls) ? entity.id : getSummonOwnerId(entity.id);
}

/** Checks a skill id against its owner's current loadout. Returns null when valid. */
function checkSkill(skillId: SkillId, owner: Doll | Summon, location: SaveLocation, ctx: Context): ErrorDetails | null {
	if (skillId === V9_END_TURN_SKILL_ID) return null;
	const remove: SaveFix = { kind: FixKey.RemoveEntry, location };
	if (!isKnownSkillId(skillId))
		return {
			code: SaveErrorCode.UnknownId,
			renderable: false,
			reason: `${owner.name} has an unknown skill "${String(skillId)}"`,
			fixes: [remove],
		};
	const requirement = getSkillRequirement(skillId);
	const ownerBase = hasPrefix(owner.id, IdKey.Summons) ? summonBaseIdOf(owner.id) : owner.id;
	if (requirement.ownerId !== ownerBase) {
		return {
			code: SaveErrorCode.UnknownId,
			renderable: false,
			reason: `"${requirement.name}" is not one of ${owner.name}'s skills`,
			fixes: [remove],
		};
	}
	const dollId = ownerDollId(owner);
	const sd = ctx.selected.get(dollId);
	const missing = (keyId: KeyId | undefined, fortification: number | undefined) => ({
		keys: keyId && !sd?.keys.includes(keyId) ? [keyId] : [],
		fortification: fortification && fortification > (sd?.fortification ?? 0) ? fortification : undefined,
	});
	const loadoutFixes = (needs: ReturnType<typeof missing>): SaveFix[] => [
		...needs.keys.map((keyId): SaveFix => ({ kind: FixKey.EquipKey, dollId, keyId })),
		...(needs.fortification ? [{ kind: FixKey.SetFortification, dollId, fortification: needs.fortification } as const] : []),
	];
	if (hasSkillFamily(skillId, owner)) {
		const skill = resolveSkill(skillId, owner);
		if (skill.id === skillId) return null;
		const replace: SaveFix = { kind: FixKey.ReplaceId, location, from: skillId, to: skill.id };
		// A saved tier/key version of the skill needs that fortification/key, even though the owner has another version
		const tier = getSkillTier(skillId);
		const needs = missing(tier.keyId, tier.fortification);
		const fixes = loadoutFixes(needs);
		if (fixes.length) {
			return {
				code: needs.keys.length ? SaveErrorCode.MissingKey : SaveErrorCode.FortificationTooLow,
				renderable: true,
				reason: `${owner.name}'s "${skill.name}" was recorded with upgrades that need ${dollName(dollId)} to ${needsText(needs.keys, needs.fortification)}`,
				fixes: [...fixes, replace, remove],
			};
		}
		return {
			code: SaveErrorCode.StaleTier,
			renderable: true,
			reason: `${owner.name}'s "${skill.name}" doesn't match ${dollName(dollId)}'s current loadout`,
			fixes: [replace],
		};
	}
	// The skill family isn't on the current loadout, so explain which requirement is missing
	const needs = missing(requirement.requiresKey, requirement.minFortification);
	const fixes = loadoutFixes(needs);
	if (!fixes.length) {
		return {
			code: SaveErrorCode.UnknownId,
			renderable: false,
			reason: `${owner.name} doesn't have the skill "${requirement.name}"`,
			fixes: [remove],
		};
	}
	return {
		code: needs.keys.length ? SaveErrorCode.MissingKey : SaveErrorCode.FortificationTooLow,
		// the skill isn't on the loadout at all, so the finders can't resolve it
		renderable: false,
		reason: `${owner.name}'s "${requirement.name}" needs ${dollName(dollId)} to ${needsText(needs.keys, needs.fortification)}`,
		fixes: [...fixes, remove],
	};
}

function isOnMap(id: DollId | SummonId, tab: SaveV9TabData): boolean {
	if (hasPrefix(id, IdKey.Dolls)) return (tab.dollPositions[id]?.x ?? -1) > -1;
	// match the summon family, so a placement and an action saved under different tier/key ids still count as the same summon
	const base = summonBaseIdOf(id);
	return tab.summonPositions.some((p) => summonBaseIdOf(p.id) === base);
}

/** Placing `id` on `tab` where it was on the closest earlier turn it was on the map; none if it never was. */
function copyPositionFix(save: SaveV9, id: DollId | SummonId, tab: number): SaveFix[] {
	for (let fromTab = tab - 1; fromTab >= 0; fromTab--) {
		if (isOnMap(id, save.tabData[fromTab])) return [{ kind: FixKey.CopyPosition, id, tab, fromTab }];
	}
	return [];
}

type Report = (location: SaveLocation, error: ErrorDetails) => void;

export function entityName(id: DollId | SummonId): string {
	if (hasPrefix(id, IdKey.Dolls)) return dollName(id);
	return isKnownSummonId(id) ? getSummonRequirement(id).name : id;
}

/** Skill type, name and what it selects, for target errors; falls back to the name or raw id when it doesn't resolve. */
function describeSkill(skillId: SkillId, owner: Doll | Summon): string {
	if (skillId === V9_END_TURN_SKILL_ID) return SkillTypeLabels[SkillType.EndTurn];
	if (!isKnownSkillId(skillId)) return String(skillId);
	if (!hasSkillFamily(skillId, owner)) return `"${getSkillRequirement(skillId).name}"`;
	const skill = resolveSkill(skillId, owner);
	const selects = skill.selects.map((s) => SkillSelectLabels[s]).join("/");
	return `${SkillTypeLabels[skill.type]} "${skill.name}"${selects ? ` (targets ${selects})` : ""}`;
}

/** The skill as the owner's loadout has it; undefined for End Turn and skills the loadout can't resolve (reported by checkSkill). */
function resolvedSkill(skillId: SkillId, owner: Doll | Summon): Skill | undefined {
	if (skillId === V9_END_TURN_SKILL_ID || !isKnownSkillId(skillId) || !hasSkillFamily(skillId, owner)) return undefined;
	return resolveSkill(skillId, owner);
}

/**
 * Fixes for a targeting skill whose target is gone (not in the team, not on the map, unknown): pick another teammate
 * or drop the skill use. Clearing just the target would leave a targeting skill without one.
 */
function retargetFixes(location: Extract<SaveLocation, { kind: "action" }>): SaveFix[] {
	return [
		{ kind: FixKey.ChooseTarget, location },
		{ kind: FixKey.RemoveEntry, location },
	];
}

/** Says plainly why `action`'s target is invalid, e.g. the targeted doll (or a summon's owner) isn't in the team. */
function invalidTargetReason(action: string, targetId: DollId | SummonId, error: ErrorDetails): string {
	if (error.code === SaveErrorCode.OwnerNotSelected) {
		if (hasPrefix(targetId, IdKey.Dolls)) return `${action} targets ${dollName(targetId)}, who is not in the team`;
		return `${action} targets ${entityName(targetId)}, but its owner ${dollName(getSummonOwnerId(targetId))} is not in the team`;
	}
	return `${action} can't target ${entityName(targetId)}: ${error.reason}`;
}

function checkTimeline(save: SaveV9, report: Report) {
	const location: SaveLocation = { kind: LocationKey.Timeline };
	if (!save.selectedDolls.length) {
		report(location, { code: SaveErrorCode.EmptyTimeline, renderable: true, reason: "The team is empty", fixes: [] });
	} else if (!save.tabData.some((tab) => Object.values(tab.actions).some((actions) => actions.length))) {
		report(location, { code: SaveErrorCode.EmptyTimeline, renderable: true, reason: "No actions are recorded", fixes: [] });
	}
}

function checkBuffs(save: SaveV9, report: Report) {
	for (const buffId of save.buffs) {
		if (isKnownBuffId(buffId)) continue;
		const location: SaveLocation = { kind: LocationKey.Buff, buffId };
		report(location, {
			code: SaveErrorCode.UnknownBuff,
			renderable: false,
			reason: `Unknown seasonal buff "${String(buffId)}"`,
			fixes: [{ kind: FixKey.RemoveEntry, location }],
		});
	}
}

/** Returns the timeline's map, or undefined (reported) when it doesn't exist. */
function checkMap(save: SaveV9, report: Report): MapGrid | undefined {
	// a custom map is found in the timeline's own copy, or failing that in a local slot
	if (isKnownMap(save.map, save.customMap)) return getMapByName(save.map, save.customMap);
	report(
		{ kind: LocationKey.Map },
		{
			code: SaveErrorCode.UnknownMap,
			renderable: true,
			reason: `Unknown map "${save.map}"`,
			fixes: [{ kind: FixKey.SetMap, map: getDefaultMap().name }],
		}
	);
	return undefined;
}

/** The valid level nearest to `value` (invalid values from old or edited saves). */
function closestLevel(levels: number[], value: number): number {
	const target = Number.isFinite(value) ? value : levels[0];
	return levels.reduce((best, candidate) => (Math.abs(candidate - target) < Math.abs(best - target) ? candidate : best));
}

/** Loadouts (keys, weapon, fortification, remolding) and team rules (one borrowed doll, one doll per owned key copy). */
function checkTeam(save: SaveV9, ctx: Context, report: Report) {
	for (const sd of save.selectedDolls) {
		const doll = ctx.resolved.get(sd.id);
		if (!doll) continue;
		const dollLocation: SaveLocation = { kind: LocationKey.Doll, dollId: sd.id };
		const invalid = (location: SaveLocation, renderable: boolean, reason: string, fixes: SaveFix[]) => {
			report(location, { code: SaveErrorCode.InvalidLoadout, renderable, reason, fixes });
		};

		if (!FORTIFICATION_LEVELS.includes(sd.fortification)) {
			invalid(dollLocation, true, `${doll.name} has an invalid fortification (V${sd.fortification})`, [
				{ kind: FixKey.SetFortification, dollId: sd.id, fortification: closestLevel(FORTIFICATION_LEVELS, sd.fortification) },
			]);
		}
		if (!REMOLDING_LEVELS.includes(sd.remoldingLvl)) {
			invalid(dollLocation, true, `${doll.name} has an invalid remolding level (${sd.remoldingLvl})`, [
				{ kind: FixKey.SetRemolding, dollId: sd.id, level: closestLevel(REMOLDING_LEVELS, sd.remoldingLvl) },
			]);
		}

		const weaponLocation: SaveLocation = { kind: LocationKey.DollWeapon, dollId: sd.id };
		const signatureWeapon: SaveFix = { kind: FixKey.SetWeapon, dollId: sd.id, weaponId: getWeaponByDollId(sd.id).id };
		if (!isKnownWeaponId(sd.gun)) {
			invalid(weaponLocation, false, `${doll.name} has an unknown weapon "${String(sd.gun)}"`, [signatureWeapon]);
		} else {
			const weapon = getWeaponById(sd.gun);
			if (weapon.gunType !== doll.gunType) {
				const reason = `${doll.name} uses ${GunTypeLabels[doll.gunType]} weapons, but has the ${GunTypeLabels[weapon.gunType]} "${weapon.name}" equipped`;
				invalid(weaponLocation, true, reason, [signatureWeapon]);
			}
		}

		const slots = new Map<KeyType, number>();
		for (const type of KEY_SLOTS) {
			if (type === KeyType.ExpansionKey && !hasExpansionKey(doll)) continue;
			slots.set(type, (slots.get(type) ?? 0) + 1);
		}
		const used = new Map<KeyType, number>();
		const seen = new Set<KeyId>();
		for (const keyId of sd.keys) {
			if (keyId === "") continue;
			const location: SaveLocation = { kind: LocationKey.DollKey, dollId: sd.id, keyId };
			const unequip: SaveFix = { kind: FixKey.UnequipKey, dollId: sd.id, keyId };
			if (!isKnownKeyId(keyId)) {
				invalid(location, false, `${doll.name} has an unknown key "${String(keyId)}"`, [unequip]);
				continue;
			}
			const key = getKeyById(keyId);
			if (seen.has(keyId)) {
				invalid(location, true, `${doll.name} has ${keyName(keyId)} equipped twice`, [unequip]);
				continue;
			}
			seen.add(keyId);
			const ownerId = getKeyOwnerId(keyId);
			if (ownerId && ownerId !== sd.id) {
				invalid(location, true, `${keyName(keyId)} belongs to ${dollName(ownerId)}, not ${doll.name}`, [unequip]);
				continue;
			}
			const count = (used.get(key.type) ?? 0) + 1;
			used.set(key.type, count);
			const limit = slots.get(key.type) ?? 0;
			if (count > limit) {
				const type = KeyTypeLabels[key.type];
				const reason = limit
					? `${doll.name} has only ${limit} ${type} slot${limit === 1 ? "" : "s"}, so "${key.name}" doesn't fit`
					: `${doll.name} has no ${type} slot for "${key.name}"`;
				invalid(location, true, reason, [unequip]);
			}
		}
	}

	checkSharedKeys(save, ctx, report);

	// one problem with a choice of which doll stays borrowed, reported on each so it's flagged wherever they show
	const borrowed = save.selectedDolls.filter((sd) => sd.borrow && ctx.resolved.has(sd.id));
	if (borrowed.length > 1) {
		const reason = "More than one doll is set as borrowed, please pick one";
		const fixes: SaveFix[] = borrowed.map((sd) => ({ kind: FixKey.SetBorrow, dollId: sd.id, borrow: true }));
		for (const sd of borrowed) {
			report({ kind: LocationKey.Doll, dollId: sd.id }, { code: SaveErrorCode.MultipleBorrowed, renderable: true, reason, fixes });
		}
	}
}

/** `A`, `A and B`, `A, B and C` */
function joinNames(names: string[]): string {
	return names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}` : (names[0] ?? "");
}

/**
 * Common and affinity keys equipped on more dolls than the player has copies of; the borrowed doll's keys aren't the
 * player's, so it never counts. Reported on every holder, so it's flagged wherever they show.
 */
function checkSharedKeys(save: SaveV9, ctx: Context, report: Report) {
	const team = save.selectedDolls.filter((sd) => ctx.resolved.get(sd.id));
	const anyBorrowed = team.some((sd) => sd.borrow);
	const keyIds = new Set(team.flatMap((sd) => sd.keys.filter((keyId): keyId is KeyId => keyId !== "" && isKnownKeyId(keyId))));
	for (const keyId of keyIds) {
		const max = maxKeyHolders(getKeyById(keyId));
		if (max === undefined) continue;
		const holders = keyHolders(team, keyId);
		if (holders.length <= max) continue;
		// borrowing any one holder brings the count back within the limit; setting a borrow clears the others, so it's
		// only offered when nobody is borrowed yet
		const canBorrow = !anyBorrowed && holders.length === max + 1;
		for (const dollId of holders) {
			const others = holders.filter((id) => id !== dollId);
			const reason =
				max === 1
					? `${keyName(keyId)} is already equipped on ${joinNames(others.map(dollName))}`
					: `${keyName(keyId)} is equipped on ${holders.length} dolls (${joinNames(holders.map(dollName))}), but only ${max} copies are allowed`;
			const fixes: SaveFix[] = [{ kind: FixKey.UnequipKey, dollId, keyId }];
			if (canBorrow) {
				for (const id of [dollId, ...others]) fixes.push({ kind: FixKey.SetBorrow, dollId: id, borrow: true });
			}
			report({ kind: LocationKey.DollKey, dollId, keyId }, { code: SaveErrorCode.SharedKey, renderable: true, reason, fixes });
		}
	}
}

const BLOCKING_TILES = [TileType.HalfCover, TileType.FullCover, TileType.BossCover, TileType.BossOrigin];

/** Grid cells taken by any doll or summon on the turn. */
function occupiedCells(tab: SaveV9TabData, map: MapGrid): Set<number> {
	const cells = new Set<number>();
	for (const position of Object.values(tab.dollPositions)) {
		if (position.x > -1 && position.y > -1) cells.add(gridKey(position.x, position.y, map.width));
	}
	for (const position of tab.summonPositions) cells.add(gridKey(position.x, position.y, map.width));
	return cells;
}

/** Whether a doll or summon can be put on the cell: on the map, not blocked, and nobody there yet. */
function isFreeCell(map: MapGrid, occupied: Set<number>, cell: number): boolean {
	const tile = (map.tiles[cell] as TileType | undefined) ?? TileType.Empty;
	return cell >= 0 && cell < map.width * map.height && !occupied.has(cell) && !BLOCKING_TILES.some((type) => isTileType(tile, type));
}

/** Placing an undeployed doll on the highest-priority free spawn tile (map priority 1 first), else any free spawn tile. */
function spawnFix(save: SaveV9, map: MapGrid, dollId: DollId): SaveFix[] {
	const occupied = occupiedCells(save.tabData[0], map);
	const isFreeSpawn = (cell: number) => isFreeCell(map, occupied, cell) && isTileType(map.tiles[cell], TileType.Spawn);
	const ranked = map.priority.findIndex(isFreeSpawn);
	const cell = ranked > -1 ? map.priority[ranked] : map.tiles.findIndex((_, c) => isFreeSpawn(c));
	if (cell === undefined || cell < 0) return [];
	const x = cell % map.width;
	const y = Math.floor(cell / map.width);
	return [{ kind: FixKey.PlaceAt, id: dollId, tab: 0, x, y, ...(ranked > -1 ? { priority: ranked + 1 } : {}) }];
}

/** Placing a summon on the free tile nearest its owner that turn (fewest steps, then straightest); none when the owner is off the map. */
function nearOwnerFix(save: SaveV9, map: MapGrid, summonId: SummonId, tabIndex: number): SaveFix[] {
	const tab = save.tabData[tabIndex];
	const ownerId = getSummonOwnerId(summonId);
	const owner = tab.dollPositions[ownerId] as Position | undefined;
	if (!owner || owner.x < 0 || owner.y < 0) return [];
	const occupied = occupiedCells(tab, map);
	let best: { x: number; y: number; steps: number; reach: number } | undefined;
	for (let y = 0; y < map.height; y++) {
		for (let x = 0; x < map.width; x++) {
			if (!isFreeCell(map, occupied, gridKey(x, y, map.width))) continue;
			const dx = Math.abs(x - owner.x);
			const dy = Math.abs(y - owner.y);
			const steps = dx + dy;
			const reach = Math.max(dx, dy);
			if (!best || steps < best.steps || (steps === best.steps && reach < best.reach)) best = { x, y, steps, reach };
		}
	}
	return best ? [{ kind: FixKey.PlaceAt, id: summonId, tab: tabIndex, x: best.x, y: best.y, near: ownerId }] : [];
}

/** Placement rules the map editor enforces when dragging, checked for every turn. */
function checkPositions(save: SaveV9, map: MapGrid, report: Report) {
	for (const [tabIndex, tab] of save.tabData.entries()) {
		const occupants = new Map<number, { name: string; location: PositionLocation; x: number; y: number }[]>();
		const checkTile = (position: Position, name: string, location: PositionLocation) => {
			const remove: SaveFix = { kind: FixKey.RemoveEntry, location };
			if (position.x < 0 || position.y < 0 || position.x >= map.width || position.y >= map.height) {
				report(location, {
					code: SaveErrorCode.InvalidPosition,
					renderable: true,
					reason: `${name} is outside the map`,
					fixes: [remove],
				});
				return;
			}
			const cell = gridKey(position.x, position.y, map.width);
			const tile = map.tiles[cell] ?? TileType.Empty;
			if (BLOCKING_TILES.some((type) => isTileType(tile, type))) {
				report(location, {
					code: SaveErrorCode.InvalidPosition,
					renderable: true,
					reason: `${name} is on a blocked tile`,
					fixes: [remove],
				});
			} else if (tabIndex === 0 && location.kind === LocationKey.DollPosition && !isTileType(tile, TileType.Spawn)) {
				// moved to an open spawn tile; taken off the map only when every spawn tile is taken
				const place = spawnFix(save, map, location.dollId);
				report(location, {
					code: SaveErrorCode.InvalidPosition,
					renderable: true,
					reason: `${name} isn't on a spawn tile`,
					fixes: place.length ? place : [remove],
				});
			}
			const here = occupants.get(cell) ?? [];
			here.push({ name, location, x: position.x, y: position.y });
			occupants.set(cell, here);
		};

		for (const sd of save.selectedDolls) {
			const location: PositionLocation = { kind: LocationKey.DollPosition, tab: tabIndex, dollId: sd.id };
			const position = tab.dollPositions[sd.id] as Position | undefined;
			if (position && position.x > -1 && position.y > -1) {
				checkTile(position, entityName(sd.id), location);
			} else if (tabIndex === 0) {
				report(location, {
					code: SaveErrorCode.DollNotDeployed,
					renderable: true,
					reason: `${entityName(sd.id)} isn't placed on the map`,
					fixes: spawnFix(save, map, sd.id),
				});
			}
		}

		for (const [index, position] of tab.summonPositions.entries()) {
			const location: PositionLocation = { kind: LocationKey.SummonPosition, tab: tabIndex, index };
			checkTile(position, entityName(position.id), location);
		}

		// one problem per shared tile with a choice of who stays, reported on each so it's flagged wherever they show
		for (const here of occupants.values()) {
			if (here.length < 2) continue;
			const names = here.map((occupant) => occupant.name);
			const reason = `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]} share a tile, please pick which one stays`;
			const fixes: SaveFix[] = here.map((occupant) => ({
				kind: FixKey.KeepOnTile,
				tab: tabIndex,
				x: occupant.x,
				y: occupant.y,
				keep: occupant.location,
			}));
			for (const occupant of here) {
				report(occupant.location, { code: SaveErrorCode.OverlappingPositions, renderable: true, reason, fixes });
			}
		}
	}
}

/** Team and loadout problems read the same on every turn they're found on, so they don't name one. */
const LOADOUT_CODES = new Set<SaveErrorCode>([
	SaveErrorCode.MissingKey,
	SaveErrorCode.FortificationTooLow,
	SaveErrorCode.NotPlayable,
	SaveErrorCode.StaleTier,
	SaveErrorCode.OwnerNotSelected,
]);

/** `Setup: ` / `Turn N: ` for problems tied to a turn; targets keep it so the action can be found. */
function turnPrefix(location: SaveLocation, code: SaveErrorCode): string {
	if (!("tab" in location)) return "";
	if (LOADOUT_CODES.has(code) && location.kind !== LocationKey.ActionTarget) return "";
	return location.tab === 0 ? "Setup: " : `Turn ${location.tab}: `;
}

/** Each distinct message once: loadout problems are reported for every turn they affect but read the same. */
export function uniqueMessages(errors: SaveError[]): string[] {
	return [...new Set(errors.map((e) => e.message))];
}

/** Same change, ignoring where: removals and id replacements for every turn a problem is on read as one fix. */
export function fixKey(fix: SaveFix): (typeof FixKey)[keyof typeof FixKey] | string {
	// choosing a target is one action at a time, so a group offers it once (for its first action)
	if (fix.kind === FixKey.RemoveEntry || fix.kind === FixKey.ChooseTarget) return fix.kind;
	if (fix.kind === FixKey.ReplaceId) return `${fix.kind}:${fix.from}:${fix.to}`;
	return JSON.stringify(fix);
}

/**
 * Loadout changes, carrying a position forward and placing on a free tile, safe to apply without asking; removing entries, adding dolls,
 * changing the map, choosing targets and choosing which doll stays borrowed are not.
 */
const AUTO_FIX_KINDS = new Set<SaveFix["kind"]>([
	FixKey.EquipKey,
	FixKey.UnequipKey,
	FixKey.SetFortification,
	FixKey.SetWeapon,
	FixKey.SetRemolding,
	FixKey.ReplaceId,
	FixKey.CopyPosition,
	FixKey.PlaceAt,
]);

export function isAutoFix(fix: SaveFix): boolean {
	return AUTO_FIX_KINDS.has(fix.kind);
}

export interface ErrorGroup {
	message: string;
	/** `message` without its turn prefix (the same for every error in the group, since they share the message) */
	reason: string;
	errors: SaveError[];
	/** Each distinct fix once (see `fixKey`), in the order the errors suggest them */
	autoFixes: SaveFix[];
	manualFixes: SaveFix[];
}

/** Errors by message, so each problem is listed once with its fixes, however many turns it's on. */
export function groupErrors(errors: SaveError[]): ErrorGroup[] {
	const groups = new Map<string, ErrorGroup & { seen: Set<FixKey | string> }>();
	for (const error of errors) {
		let group = groups.get(error.message);
		if (!group) {
			group = { message: error.message, reason: error.reason, errors: [], autoFixes: [], manualFixes: [], seen: new Set() };
			groups.set(error.message, group);
		}
		group.errors.push(error);
		for (const fix of error.fixes) {
			const key = fixKey(fix);
			if (group.seen.has(key)) continue;
			group.seen.add(key);
			(isAutoFix(fix) ? group.autoFixes : group.manualFixes).push(fix);
		}
	}
	return [...groups.values()].map(({ seen: _seen, ...group }) => group);
}

/** Order issues are listed in within a section: team and loadout, then what's unlocked, then positions, then targets. */
const ISSUE_TYPE_RANK: Record<SaveErrorCode, number> = {
	[SaveErrorCode.EmptyTimeline]: 0,
	[SaveErrorCode.UnknownMap]: 1,
	[SaveErrorCode.UnknownBuff]: 2,
	[SaveErrorCode.MultipleBorrowed]: 3,
	[SaveErrorCode.InvalidLoadout]: 4,
	[SaveErrorCode.SharedKey]: 5,
	[SaveErrorCode.OwnerNotSelected]: 6,
	[SaveErrorCode.UnknownId]: 7,
	[SaveErrorCode.MissingKey]: 8,
	[SaveErrorCode.FortificationTooLow]: 9,
	[SaveErrorCode.NotPlayable]: 10,
	[SaveErrorCode.StaleTier]: 11,
	[SaveErrorCode.DollNotDeployed]: 12,
	[SaveErrorCode.InvalidPosition]: 13,
	[SaveErrorCode.OverlappingPositions]: 14,
	[SaveErrorCode.ActorNotOnMap]: 15,
	[SaveErrorCode.MissingTarget]: 16,
	[SaveErrorCode.TargetNotOnMap]: 17,
};

/** The doll or summon an entry is about, for sorting; undefined for timeline-wide entries (map, buffs). */
function locationSubject(location: SaveLocation): DollId | SummonId | undefined {
	switch (location.kind) {
		case LocationKey.Action:
		case LocationKey.ActionTarget:
		case LocationKey.ActionList:
			return location.ownerId;
		case LocationKey.ActionOrder:
			return state.tabData[location.tab]?.actionOrder[location.index] as DollId | SummonId | undefined;
		case LocationKey.SummonPosition:
			return (state.tabData[location.tab]?.summonPositions[location.index] as SaveV9TabData["summonPositions"][number] | undefined)
				?.id;
		case LocationKey.DollPosition:
		case LocationKey.Doll:
		case LocationKey.DollWeapon:
		case LocationKey.DollKey:
			return location.dollId;
		case LocationKey.Timeline:
		case LocationKey.Map:
		case LocationKey.Buff:
			return undefined;
	}
}

/** Name for sorting; never throws, since the entry being reported can be an id the game data doesn't know. */
function subjectName(id: DollId | SummonId | undefined): string {
	if (id === undefined) return "";
	if (hasPrefix(id, IdKey.Dolls)) return (combinedDolls.data[id] as Doll | undefined)?.name ?? id;
	return entityName(id);
}

/**
 * The doll or summon an issue is about, for its icon in the issue list; undefined when it's about the whole timeline
 * (map, buffs), or an id the game data doesn't know or has no icon for.
 */
export function issueSubject(group: ErrorGroup): { name: string; icon: string } | undefined {
	const id = locationSubject(group.errors[0].location);
	if (!id) return undefined;
	if (hasPrefix(id, IdKey.Dolls)) {
		const doll = combinedDolls.data[id] as Doll | undefined;
		return doll ? { name: doll.name, icon: doll.icons.avatar } : undefined;
	}
	const icon = getSummonIcon(id);
	return icon ? { name: entityName(id), icon } : undefined;
}

export interface IssueSection {
	/** `General`, `Setup` or `Turn N` */
	title: string;
	groups: ErrorGroup[];
}

/**
 * Groups split into General (no turn, or spanning several turns like a missing key) then Setup and each turn,
 * each sorted by issue type and then by the character it's about. Empty sections are left out.
 */
export function sectionIssues(groups: ErrorGroup[]): IssueSection[] {
	const GENERAL = -1;
	const sections = new Map<number, { group: ErrorGroup; rank: number; name: string }[]>();
	for (const group of groups) {
		const tabs = new Set(group.errors.map((error) => ("tab" in error.location ? error.location.tab : GENERAL)));
		const key = tabs.size === 1 ? [...tabs][0] : GENERAL;
		const first = group.errors[0];
		const entries = sections.get(key) ?? [];
		entries.push({ group, rank: ISSUE_TYPE_RANK[first.code], name: subjectName(locationSubject(first.location)) });
		sections.set(key, entries);
	}
	return [...sections]
		.sort(([a], [b]) => a - b)
		.map(([key, entries]) => ({
			title: key === GENERAL ? "General" : key === 0 ? "Setup" : `Turn ${key}`,
			groups: entries
				.sort((a, b) => a.rank - b.rank || a.name.localeCompare(b.name) || a.group.message.localeCompare(b.group.message))
				.map((entry) => entry.group),
		}));
}

/** Every reason the save can't be shared as-is. Pure: never throws on bad save data, only on missing game data. */
export function validateSave(save: SaveV9): SaveError[] {
	const ctx: Context = {
		selected: new Map(save.selectedDolls.map((sd) => [sd.id, sd])),
		resolved: new Map(save.selectedDolls.map((sd) => [sd.id, getSelectedDoll(sd)])),
	};
	const errors: SaveError[] = [];
	const report: Report = (location, error) => {
		const { reason, ...rest } = error;
		errors.push({ ...rest, location, reason, message: turnPrefix(location, error.code) + reason });
	};
	const push = (_tab: number, location: SaveLocation, error: ErrorDetails) => {
		report(location, error);
	};

	checkTimeline(save, report);
	checkBuffs(save, report);
	checkTeam(save, ctx, report);
	const map = checkMap(save, report);
	if (map) checkPositions(save, map, report);

	for (const [tabIndex, tab] of save.tabData.entries()) {
		for (const [index, id] of tab.actionOrder.entries()) {
			const location: SaveLocation = { kind: LocationKey.ActionOrder, tab: tabIndex, index };
			const check = checkEntity(id, location, ctx);
			// The order lists every summon of the selected dolls, including locked ones, so only report entries the
			// finders can't resolve at all; locked or stale summons are reported where they're placed or act
			if (!check.ok && (check.error.code === SaveErrorCode.OwnerNotSelected || check.error.code === SaveErrorCode.UnknownId)) {
				push(tabIndex, location, check.error);
			}
		}
		for (const [index, position] of tab.summonPositions.entries()) {
			const location: SaveLocation = { kind: LocationKey.SummonPosition, tab: tabIndex, index };
			const check = checkEntity(position.id, location, ctx);
			if (!check.ok) push(tabIndex, location, check.error);
			// a stale tier still resolves, so its key is checked too
			const summon = (check.ok ? check.entity : check.resolved) as Summon | undefined;
			const fieldError = summon && checkSummonFielded(position.id, summon, location, ctx);
			if (fieldError) push(tabIndex, location, fieldError);
		}
		for (const [ownerKey, actions] of Object.entries(tab.actions)) {
			if (!actions.length) continue;
			const ownerId = ownerKey as DollId | SummonId;
			const listLocation: SaveLocation = { kind: LocationKey.ActionList, tab: tabIndex, ownerId };
			const owner = checkEntity(ownerId, listLocation, ctx);
			if (!owner.ok) push(tabIndex, listLocation, owner.error);
			// a stale owner still resolves, so its actions can be checked against the current summon
			const ownerEntity = owner.ok ? owner.entity : owner.resolved;
			if (!ownerEntity) continue;
			if (hasPrefix(ownerId, IdKey.Summons)) {
				// summons that can never act may still carry listings (end turn, old saves); those aren't errors
				if (!isEverPlayable(ownerId)) continue;
				const lockError = checkSummonUnlocked(ownerId, ownerEntity as Summon, listLocation, ctx);
				if (lockError) push(tabIndex, listLocation, lockError);
			}
			if (!isOnMap(ownerId, tab)) {
				push(tabIndex, listLocation, {
					code: SaveErrorCode.ActorNotOnMap,
					renderable: true,
					reason: `${ownerEntity.name} has actions but is not on the map`,
					// a summon goes next to its owner first (the automatic fix), else where it stood on an earlier turn
					fixes: [
						...(map && hasPrefix(ownerId, IdKey.Summons) ? nearOwnerFix(save, map, ownerId, tabIndex) : []),
						...copyPositionFix(save, ownerId, tabIndex),
						{ kind: FixKey.RemoveEntry, location: listLocation },
					],
				});
			}
			for (const [index, [skillId, targetId]] of actions.entries()) {
				const location = { kind: LocationKey.Action, tab: tabIndex, ownerId, index } as const;
				const skillError = checkSkill(skillId, ownerEntity, location, ctx);
				if (skillError) push(tabIndex, location, skillError);
				const skill = resolvedSkill(skillId, ownerEntity);
				const action = `${ownerEntity.name}'s ${describeSkill(skillId, ownerEntity)}`;
				if (targetId === undefined) {
					if (skill && needsAllyTarget(skill)) {
						push(tabIndex, location, {
							code: SaveErrorCode.MissingTarget,
							renderable: true,
							reason: `${action} has no target`,
							fixes: retargetFixes(location),
						});
					}
					continue;
				}
				const targetLocation: SaveLocation = { kind: LocationKey.ActionTarget, tab: tabIndex, ownerId, index };
				const removeTarget: SaveFix = { kind: FixKey.RemoveEntry, location: targetLocation };
				// when the skill can't be resolved, a recorded target means it was a targeting skill
				const needsTarget = skill ? needsAllyTarget(skill) : true;
				const target = checkEntity(targetId, targetLocation, ctx);
				if (!target.ok) {
					// a missing teammate is replaced or the skill dropped; other fixes (equip a key, update the id) still apply
					const fixes =
						needsTarget && target.error.code !== SaveErrorCode.StaleTier
							? [
									...target.error.fixes.filter(
										(fix) => fix.kind !== FixKey.RemoveEntry && fix.kind !== FixKey.SelectDoll
									),
									...retargetFixes(location),
								]
							: target.error.fixes;
					push(tabIndex, targetLocation, { ...target.error, fixes, reason: invalidTargetReason(action, targetId, target.error) });
				}
				// a stale target still resolves, so it's checked too rather than waiting until its id is updated
				const targetEntity = target.ok ? target.entity : target.resolved;
				if (targetEntity && !isOnMap(targetId, tab)) {
					push(tabIndex, targetLocation, {
						code: SaveErrorCode.TargetNotOnMap,
						renderable: true,
						reason: `${action} targets ${targetEntity.name}, who is not on the map`,
						// the target can be put back where it stood on an earlier turn, or another one picked
						fixes: [...copyPositionFix(save, targetId, tabIndex), ...(needsTarget ? retargetFixes(location) : [removeTarget])],
					});
				}
			}
		}
	}
	return errors;
}

function locationKey(location: SaveLocation): string {
	const fields = location as Partial<Record<string, string | number>>;
	return [location.kind, fields.tab, fields.ownerId, fields.index, fields.dollId, fields.keyId, fields.buffId]
		.map((value) => String(value ?? ""))
		.join(":");
}

/**
 * A memo created on first use rather than at import: validating reads other modules (maps, game data), and building
 * the memo while modules are still initialising would run it before those exist.
 */
function lazyMemo<T>(fn: () => T): Accessor<T> {
	let memo: Accessor<T> | undefined;
	return () => {
		memo ??= createRoot(() => createMemo(fn));
		return memo();
	};
}

export const saveErrors = lazyMemo(() => validateSave(state));

/** The timeline's errors grouped by message, as listed in the issues modal and counted on its buttons. */
export const saveIssueGroups = lazyMemo(() => groupErrors(saveErrors()));

/** `saveIssueGroups` split by turn and sorted, as the issues modal lists them. */
export const saveIssueSections = lazyMemo(() => sectionIssues(saveIssueGroups()));

/** Sharing (export/url) is only allowed once every error is resolved. */
export const isShareable = () => saveErrors().length === 0;

/** Errors grouped by location, for highlighting entries in the UI. */
const errorsByLocation = lazyMemo(() => {
	const map = new Map<string, SaveError[]>();
	for (const error of saveErrors()) {
		const key = locationKey(error.location);
		map.set(key, [...(map.get(key) ?? []), error]);
	}
	return map;
});

/** Every error affecting one action: the action itself, its target, and its owner's action list. */
export function getActionErrors(at: { tab: number; ownerId: DollId | SummonId; index: number }): SaveError[] {
	const errors = errorsByLocation();
	return [
		...(errors.get(locationKey({ kind: LocationKey.ActionList, tab: at.tab, ownerId: at.ownerId })) ?? []),
		...(errors.get(locationKey({ kind: LocationKey.Action, ...at })) ?? []),
		...(errors.get(locationKey({ kind: LocationKey.ActionTarget, ...at })) ?? []),
	];
}

const unrenderable = lazyMemo(
	() =>
		new Set(
			saveErrors()
				.filter((e) => !e.renderable)
				.map((e) => locationKey(e.location))
		)
);

/** Whether the finders can resolve the entry at `location`; check this before rendering store entries. */
export function isRenderable(location: SaveLocation): boolean {
	if (unrenderable().has(locationKey(location))) return false;
	// an action is only renderable if its owner is
	if (location.kind === LocationKey.Action || location.kind === LocationKey.ActionTarget) {
		return !unrenderable().has(locationKey({ kind: LocationKey.ActionList, tab: location.tab, ownerId: location.ownerId }));
	}
	return true;
}
