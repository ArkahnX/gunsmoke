export interface Skill {
	id: number;
	name: string;
	type: string;
	range: string | null;
	tags?: string[];
	localImagePath: string;
}

export interface SummonData {
	id: string;
	dollId: string;
	name: string;
	avatar: string;
	skills: Skill[];
	preloadedImage?: HTMLImageElement;
}

export interface DollData {
	id: string;
	name: string;
	phase: string;
	rarity: string;
	avatar: string;
	hasSummons: boolean;
	skills: Skill[];
	summons: string[]; // summon IDs
	preloadedImage?: HTMLImageElement;
}

export interface Position {
	x: number;
	y: number;
}

export interface SummonPosition {
	id: string;
	mapId: string;
	x: number;
	y: number;
}

export type SkillAction = [number, string?]; // [skillId, optionalTargetId]

export interface TabData {
	actionOrder: string[];
	actions: Record<string, SkillAction[]>;
	dollPositions: Record<string, Position>;
	summonPositions: SummonPosition[];
}

export interface SelectedDoll {
	id: string;
	fortification: number;
}

export interface AppState {
	selectedDolls: SelectedDoll[];
	currentTab: number; // -1=editor, 0-7=arena, 8=summary
	actionType: number|string;
	tabData: TabData[];
}

export interface MapCell {
	cover: "boss" | "hcov" | "fcov" | null;
	bossOrigin: [number, number] | null;
	spawn: boolean;
	bndH: boolean;
	bndV: boolean;
}

export type EditorTool = "spawn" | "hbnd" | "hcov" | "fcov" | "boss" | "erase";
export type BoundaryDir = "h" | "v";

export interface MapTile {
	type: "spawn" | "hcov" | "fcov" | "boss" | "hbnd_h" | "hbnd_v";
	c: number;
	r: number;
}

export interface MapData {
	cols: number;
	rows: number;
	tiles: MapTile[];
}

export type PhaseTab = "All" | "Physical" | "Burn" | "Electric" | "Freeze" | "Corrosion" | "Hydro";

export const PHASE_TABS: PhaseTab[] = ["All", "Physical", "Burn", "Electric", "Freeze", "Corrosion", "Hydro"];

export interface RawSummonEntry {
	name: string;
	id: string;
	localImagePath: string;
	skills?: Skill[];
}

export interface RawDollEntry {
	id: string;
	name: string;
	phase: string;
	avatar: string;
	rarity: string;
	skills?: Skill[];
	summons?: RawSummonEntry[];
}

export interface Camera {
	x: number; // world-space X at screen center
	y: number; // world-space Y at screen center
	scale: number; // screen pixels per world unit (before dpr)
}

export interface WorldRect {
	x: number;
	y: number;
	width: number;
	height: number;
}

export interface MapBounds {
	minX: number;
	minY: number;
	maxX: number;
	maxY: number;
}

export interface DragState {
	id: string;
	instanceId: string | null; // used for summons since they can appear more than once
	screenX: number; // current pointer position in CSS pixels
	screenY: number;
	currentTileX: number; // tile column the ghost is hovering over
	currentTileY: number;
	isValid: boolean; // tile is in-bounds and unoccupied
}

export interface DollInfo {
	x: number;
	y: number;
	id: string;
	dollInfo: DollData | undefined;
	summonInfo: SummonData | null | undefined;
	instanceId: string | null | undefined;
	dragId: string | undefined;
	dragInstanceId: string | null | undefined;
	obscured: boolean;
}

export interface TabBarProps {
	onTabChange: (tab: number) => void;
}

export interface ArenaCanvasProps {
	onCoordsChange: (coords: string) => void;
	onMouseUp: () => void;
}

export interface DollRowProps {
	dollId: string;
	index: number;
}
