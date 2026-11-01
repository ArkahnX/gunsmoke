import { BuffId, Doll, DollId, KeyId, SkillId, Summon, SummonId, WeaponId } from "../../gfl2-data/types";
import { SaveV9SelectedDoll } from "./saves";

export enum LocationKey {
	ActionOrder = "actionOrder",
	ActionList = "actionList",
	Action = "action",
	ActionTarget = "actionTarget",
	SummonPosition = "summonPosition",
	DollPosition = "dollPosition",
	Timeline = "timeline",
	Map = "map",
	Buff = "buff",
	Doll = "doll",
	DollWeapon = "dollWeapon",
	DollKey = "dollKey",
}

export type SaveLocation =
	| { kind: LocationKey.ActionOrder; tab: number; index: number }
	/** every action of one owner, used when the owner itself is invalid */
	| { kind: LocationKey.ActionList; tab: number; ownerId: DollId | SummonId }
	| { kind: LocationKey.Action; tab: number; ownerId: DollId | SummonId; index: number }
	| { kind: LocationKey.ActionTarget; tab: number; ownerId: DollId | SummonId; index: number }
	| { kind: LocationKey.SummonPosition; tab: number; index: number }
	| { kind: LocationKey.DollPosition; tab: number; dollId: DollId }
	/** the timeline as a whole (empty timeline) */
	| { kind: LocationKey.Timeline }
	| { kind: LocationKey.Map }
	| { kind: LocationKey.Buff; buffId: BuffId }
	/** a selected doll's loadout or team settings (fortification, remolding, borrow) */
	| { kind: LocationKey.Doll; dollId: DollId }
	| { kind: LocationKey.DollWeapon; dollId: DollId }
	| { kind: LocationKey.DollKey; dollId: DollId; keyId: KeyId };

export enum FixKey {
	EquipKey = "equipKey",
	SetFortification = "setFortification",
	ReplaceId = "replaceId",
	SelectDoll = "selectDoll",
	UnequipKey = "unequipKey",
	SetWeapon = "setWeapon",
	SetRemolding = "setRemolding",
	SetBorrow = "setBorrow",
	SetMap = "setMap",
	RemoveEntry = "removeEntry",
	ChooseTarget = "chooseTarget",
	CopyPosition = "copyPosition",
	PlaceAt = "placeAt",
	KeepOnTile = "keepOnTile",
}

/** Where a doll or summon stands on one turn. */
export type PositionLocation = Extract<SaveLocation, { kind: LocationKey.DollPosition | LocationKey.SummonPosition }>;

/** Structured so `applySaveFix(fix)` (saveFixes.ts) can perform it. */
export type SaveFix =
	| { kind: FixKey.EquipKey; dollId: DollId; keyId: KeyId }
	| { kind: FixKey.SetFortification; dollId: DollId; fortification: number }
	| { kind: FixKey.ReplaceId; location: SaveLocation; from: SkillId | SummonId; to: SkillId | SummonId }
	| { kind: FixKey.SelectDoll; dollId: DollId }
	| { kind: FixKey.UnequipKey; dollId: DollId; keyId: KeyId }
	| { kind: FixKey.SetWeapon; dollId: DollId; weaponId: WeaponId }
	| { kind: FixKey.SetRemolding; dollId: DollId; level: number }
	| { kind: FixKey.SetBorrow; dollId: DollId; borrow: boolean }
	| { kind: FixKey.SetMap; map: string }
	| { kind: FixKey.RemoveEntry; location: SaveLocation }
	/** Opens the target picker to replace the action's target; needs the user, so `applySaveFix` can't perform it */
	| { kind: FixKey.ChooseTarget; location: Extract<SaveLocation, { kind: "action" }> }
	/** Places a doll or summon on `tab` where it was on `fromTab` (the closest earlier turn it was on the map) */
	| { kind: FixKey.CopyPosition; id: DollId | SummonId; tab: number; fromTab: number }
	/**
	 * Places a doll or summon on (x, y) on `tab`: an undeployed doll on the highest-priority free spawn tile (`priority`,
	 * 1 = highest; absent for a spawn tile with no priority), or a summon on the free tile nearest its owner (`near`)
	 */
	| { kind: FixKey.PlaceAt; id: DollId | SummonId; tab: number; x: number; y: number; priority?: number; near?: DollId }
	/** Leaves `keep` on the shared tile (x, y) on `tab` and takes everyone else there off the map that turn */
	| { kind: FixKey.KeepOnTile; tab: number; x: number; y: number; keep: PositionLocation };

export enum SaveErrorCode {
	/** skill/summon requires a key the owning doll doesn't have equipped */
	MissingKey = "missingKey",
	/** skill only exists at a higher fortification */
	FortificationTooLow = "fortificationTooLow",
	/** id is another tier/replacement of a skill/summon the owner has (e.g. fortification or keys changed) */
	StaleTier = "staleTier",
	/** entry belongs to a doll that isn't selected */
	OwnerNotSelected = "ownerNotSelected",
	/** action targets an entity that isn't placed on the map that turn */
	TargetNotOnMap = "targetNotOnMap",
	/** a skill that picks an ally was recorded without a target */
	MissingTarget = "missingTarget",
	/** entity has actions on a turn where it isn't placed on the map */
	ActorNotOnMap = "actorNotOnMap",
	/** summon uses skills but its owner lacks the key/fortification that makes it controllable */
	NotPlayable = "notPlayable",
	/** id isn't in the game data, or doesn't belong to its owner */
	UnknownId = "unknownId",
	/** buff isn't in the game data */
	UnknownBuff = "unknownBuff",
	/** a doll's keys, weapon, fortification or remolding level aren't possible in game */
	InvalidLoadout = "invalidLoadout",
	/** the timeline's map doesn't exist */
	UnknownMap = "unknownMap",
	/** a doll/summon is outside the map, on a blocked tile, or (turn 0) a doll isn't on a spawn tile */
	InvalidPosition = "invalidPosition",
	/** two entities occupy the same tile on a turn */
	OverlappingPositions = "overlappingPositions",
	/** a common or affinity key is equipped on more than one doll that isn't borrowed */
	SharedKey = "sharedKey",
	/** more than one doll is borrowed */
	MultipleBorrowed = "multipleBorrowed",
	/** no dolls are selected, or no actions are recorded */
	EmptyTimeline = "emptyTimeline",
	/** a selected doll isn't placed on turn 0 */
	DollNotDeployed = "dollNotDeployed",
}

export interface SaveError {
	code: SaveErrorCode;
	location: SaveLocation;
	message: string;
	/** `message` without its `Turn N: ` prefix, for lists already split by turn */
	reason: string;
	/** Empty when the entry can only be removed by hand; the first fix is the suggested one */
	fixes: SaveFix[];
	/** Whether the finders can still resolve the entry, so it can be drawn (flagged) instead of shown as "?" */
	renderable: boolean;
}

export interface Context {
	selected: Map<DollId, SaveV9SelectedDoll>;
	resolved: Map<DollId, Doll>;
}

export type ErrorDetails = Omit<SaveError, "location" | "message"> & { reason: string };
/** `resolved` is set when the entry is invalid but still resolves (stale tier), so its actions can still be checked */
export type EntityCheck = { ok: true; entity: Doll | Summon } | { ok: false; error: ErrorDetails; resolved?: Doll | Summon };
