export interface Skill {
	id: number;
	name: string;
	type: string;
	range: string | null;
	tags?: string[];
	localImagePath: string;
}

export interface FixedKey {
	id: string;
	name: string;
	rarity: string;
	type: string;
	number: number | null;
	localImagePath: string;
}

export interface CommonKey extends FixedKey {
	dollId: string;
}

export interface DetailedKey extends CommonKey {
	dollName: string;
	dollAvatar: string;
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
	remolding: string;
	gunType: string;
	hasSummons: boolean;
	hasExpansionKey: boolean;
	skills: Skill[];
	keys: FixedKey[];
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
	keys: string[];
	remoldingLvl: number;
	gun: string;
	borrow: boolean;
}

export interface AppState {
	selectedDolls: SelectedDoll[];
	currentTab: number; // -1=editor, 0-7=arena, 8=summary
	/** @deprecated as of v8 */
	actionType?: number | string;
	map: string;
	score: number;
	description: string;
	buffs: string[];
	skillDisplay: number[];
	tabData: TabData[];
}

export interface StateEntry {
	stateId: string;
	map: string;
	dollIds: string[];
	score: number;
	description: string;
	state: string;
}

export interface SkillDisplay {
	skillDisplay: number[];
	override: boolean;
}

export interface MapGrid {
	size: number;
	name: string;
	default?: boolean;
	locked?: boolean;
	priority: number[];
	tiles: TileType[];
}

export const enum TileType {
	Empty = 0,
	Spawn = 1 << 0,
	HBoundary = 1 << 1,
	VBoundary = 1 << 2,
	HalfCover = 1 << 3,
	FullCover = 1 << 4,
	BossCover = 1 << 5,
	BossOrigin = 1 << 6,
}

export interface MapCell {
	type: TileType;
	cover: "boss" | "hcov" | "fcov" | null;
	bossOrigin: [number, number] | null;
	spawn: boolean;
	bndH: boolean;
	bndV: boolean;
}

export type EditorTool = "spawn" | "hbnd_h" | "hbnd_v" | "hcov" | "fcov" | "boss" | "erase";
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
	remolding: string;
	rarity: string;
	gunType: string;
	skills?: Skill[];
	keys?: FixedKey[];
	summons?: RawSummonEntry[];
}

export interface KeyData {
	common: DetailedKey[];
	affinity: DetailedKey[];
}

export interface RawKeyData {
	common: CommonKey[];
	affinity: CommonKey[];
}

export interface WeaponData {
	name: string;
	type: string;
	id: string;
	attribute: string;
	rarity: string;
	imprintId: string | null;
	imprintName: string | null;
	imprintImage: string | null;
	localImagePath: string;
}

export interface BuffData {
	name: string;
	description: string;
	id: string;
	season: number;
	core: boolean;
	days: Record<string, number[]>;
	localImagePath: string;
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

export const enum DragStatus {
	Valid,
	Blocked,
	Swap,
	Discard,
}

export interface DragState {
	id: string;
	instanceId: string | null; // used for summons since they can appear more than once
	screenX: number; // current pointer position in CSS pixels
	screenY: number;
	currentTileX: number; // tile column the ghost is hovering over
	currentTileY: number;
	status: DragStatus;
	isActive: boolean;
}

export interface DollInfo {
	x: number;
	y: number;
	id: string;
	priority: number;
	dollInfo: DollData | undefined;
	summonInfo: SummonData | null | undefined;
	instanceId: string | null;
	dragId: string | undefined;
	dragInstanceId: string | null | undefined;
	obscured: boolean;
	distance: "near" | "far" | null;
	borrow: boolean;
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

export interface ApiResponse<T = unknown> {
	success: boolean;
	result?: T;
	error?: string;
}
