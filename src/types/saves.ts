import { MapGrid, Position } from ".";
import { AttachmentId, BuffId, DollId, EnemyId, KeyId, RemoldingId, SkillId, SummonId, WeaponId } from "../../gfl2-data/types";

export interface SaveV7 {
	selectedDolls: { id: string; fortification?: number; keys?: (string | null)[]; remoldingLvl?: number; gun?: string; borrow?: boolean }[];
	currentTab: number;
	actionType?: number | string;
	skillDisplay?: number[];
	/** can be missing or malformed; normalized to string[] by migration */
	buffs?: unknown;
	map?: string;
	tabData: SaveV8TabData[];
	version: 7;
}

export interface SaveV8 {
	selectedDolls: SaveV8SelectedDoll[];
	currentTab: number;
	/** missing in some older v8 saves */
	map?: string;
	score: number;
	description: string;
	/** can be missing or malformed; normalized to string[] by migration */
	buffs?: unknown;
	skillDisplay?: number[];
	tabData: SaveV8TabData[];
	version: 8;
}

export interface SaveV9 {
	selectedDolls: SaveV9SelectedDoll[];
	map: string;
	score: number;
	description: string;
	buffs: BuffId[];
	tabData: SaveV9TabData[];
	/** A copy of the map when `map` names a custom one, so the timeline still loads where that map isn't saved */
	customMap?: MapGrid;
	version: 9;
}

export interface SaveV10 {
	dolls: DollEquipment[];
	turns: Turn[];
	buffs: BuffId[];
	mapId: string;
	description: string;
	score: number;
	version: 10;
}

export type AnySave = SaveV7 | SaveV8 | SaveV9 | SaveV10;
export type CurrentSave = SaveV9; // TODO: Update to SaveV10 when ready

export interface SaveV8TabData {
	actionOrder: string[];
	actions: Record<string, SaveV8Action[]>;
	dollPositions: Record<string, Position>;
	summonPositions: SaveV8SummonPosition[];
}

export interface SaveV9TabData {
	actionOrder: (DollId | SummonId)[];
	actions: Record<string, SaveV9Action[]>;
	dollPositions: Record<DollId, Position>;
	summonPositions: SaveV9SummonPosition[];
}

export type SaveV8Action = [skillId: number, dollId?: string];

export type SaveV9Action = [SkillId, (DollId | SummonId)?]; // [skillId, optionalTargetId]

export interface SaveV8SelectedDoll {
	id: string;
	fortification: number;
	keys: (string | null)[] /* 8 slots, "" = empty (null in some older saves) */;
	remoldingLvl: number;
	gun: string /* "" allowed */;
	borrow: boolean;
}

export interface SaveV9SelectedDoll {
	id: DollId;
	fortification: number;
	keys: (KeyId | "")[];
	remoldingLvl: number;
	gun: WeaponId;
	borrow: boolean;
}

export interface SaveV8SummonPosition {
	id: string;
	mapId: string;
	x: number;
	y: number;
}

export interface SaveV9SummonPosition {
	id: SummonId;
	mapId: string;
	x: number;
	y: number;
}

export interface DollEquipment {
	id: DollId;
	fortification: number;
	affinity: number;
	borrow: boolean;
	keys: { id: KeyId; stats: Record<string, number> }[];
	remolding: {
		level: number;
		stats: Record<RemoldingId, number>;
	};
	gun: {
		id: WeaponId;
		calibration: number;
		set: AttachmentId;
		stats: Record<string, number>;
	};
}

export interface Turn {
	dolls: DollTurn[];
}

export interface DollTurn {
	id: DollId | SummonId;
	instance: string;
	position: Position;
	actions: DollAction[];
}

export type DollAction = MoveAction | EndTurnAction | RemoveAction | SkillAction;

export enum ActionType {
	Move,
	Skill,
	EndTurn,
	Remove,
}

export interface MoveAction {
	type: ActionType.Move;
	data: Position;
}

export interface RemoveAction {
	type: ActionType.Remove;
}

export interface EndTurnAction {
	type: ActionType.EndTurn;
}

export interface SkillAction {
	type: ActionType.Skill;
	data: SkillData;
}

export interface SkillData {
	id: SkillId;
	target?: Position | SkillTarget | null;
	moveTo?: Position;
}

export interface SkillTarget {
	id: DollId | SummonId | EnemyId | null;
	instance: string | null;
}
