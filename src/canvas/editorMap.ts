import { CUSTOM_MAP_SLOTS_KEY, MAP_SLOT_COUNT, MAX_MAP_SIZE, MIN_MAP_SIZE, V7_EDITOR_MAP_KEY } from "../types/constants";
import { MapGrid, TileType } from "../types";
import { createSignal } from "solid-js";
import { produce } from "solid-js/store";
import { fillGrid, gridKey, isTileType, mapGrid } from "../store/mapGrid";
import { setState, state } from "../store/appState";
import { localStorageLoad, saveToLocalStorage } from "../store/storage";
import { log } from "../log";

const empty__ = TileType.Empty;
const spawn__ = TileType.Spawn;
const hbound_ = TileType.HBoundary;
const hvbound = TileType.HBoundary | TileType.VBoundary;
const hspawn_ = TileType.HBoundary | TileType.Spawn;
const vbound_ = TileType.VBoundary;
const vspawn_ = TileType.VBoundary | TileType.Spawn;
const hcover_ = TileType.HalfCover;
const fcover_ = TileType.FullCover;
const bosssub = TileType.BossCover;
const bossman = TileType.BossOrigin;

// prettier-ignore
const maps: MapGrid[] = [{id: "temblorTitan", name:"Temblor Titan", width:15, height:15, locked: true, default: true,
		priority:[gridKey(7, 12, 15), gridKey(8, 12, 15), gridKey(7, 13, 15), gridKey(8, 13, 15), gridKey(6, 1, 15), gridKey(7, 1, 15), gridKey(6, 2, 15), gridKey(7, 2, 15)],
	tiles: [
		empty__, empty__, empty__, empty__, empty__, empty__, empty__, empty__, empty__, empty__, empty__, empty__, empty__, empty__, empty__,
		empty__, empty__, hcover_, empty__, empty__, empty__, spawn__, spawn__, empty__, hbound_, empty__, empty__, empty__, empty__, empty__,
		empty__, empty__, hcover_, empty__, empty__, empty__, hspawn_, hspawn_, empty__, hbound_, hcover_, hcover_, hcover_, empty__, empty__,
		empty__, empty__, hcover_, hcover_, hbound_, empty__, hbound_, hbound_, empty__, empty__, empty__, empty__, hcover_, hbound_, empty__,
		empty__, empty__, empty__, empty__, hbound_, empty__, empty__, empty__, empty__, empty__, empty__, empty__, empty__, hbound_, empty__,
		empty__, empty__, empty__, empty__, empty__, empty__, empty__, empty__, empty__, empty__, empty__, empty__, empty__, empty__, empty__,
		empty__, empty__, hvbound, vbound_, empty__, empty__, bosssub, bosssub, bosssub, empty__, empty__, vbound_, vbound_, empty__, empty__,
		empty__, empty__, hvbound, vbound_, empty__, empty__, bosssub, bossman, bosssub, empty__, empty__, vbound_, vbound_, empty__, empty__,
		empty__, empty__, empty__, empty__, empty__, empty__, bosssub, bosssub, bosssub, empty__, empty__, empty__, empty__, empty__, empty__,
		empty__, empty__, empty__, empty__, empty__, empty__, empty__, empty__, empty__, empty__, empty__, empty__, empty__, empty__, empty__,
		empty__, empty__, empty__, empty__, empty__, empty__, empty__, empty__, empty__, empty__, empty__, empty__, hcover_, empty__, empty__,
		empty__, hbound_, empty__, vbound_, vbound_, empty__, empty__, hbound_, hbound_, empty__, empty__, hbound_, hcover_, empty__, empty__,
		empty__, hbound_, hcover_, hcover_, hcover_, empty__, empty__, hspawn_, hspawn_, empty__, empty__, hbound_, hcover_, empty__, empty__,
		empty__, empty__, empty__, empty__, empty__, empty__, empty__, spawn__, spawn__, empty__, empty__, empty__, empty__, empty__, empty__,
		empty__, empty__, empty__, empty__, empty__, empty__, empty__, empty__, empty__, empty__, empty__, empty__, empty__, empty__, empty__,
	]},{id: "brokenHornBeasteel", name:"Broken-Horn Beasteel", width:18, height:22, locked: true, default: false,
		priority:[gridKey(1, 13, 18), gridKey(1, 12, 18), gridKey(1, 8, 18), gridKey(1, 7, 18), gridKey(5, 2, 18), gridKey(6, 2, 18), gridKey(10, 2, 18), gridKey(11, 2, 18), gridKey(16, 7, 18), gridKey(16, 8, 18), gridKey(16, 12, 18), gridKey(16, 13, 18), gridKey(11, 18, 18), gridKey(10, 18, 18), gridKey(6, 18, 18), gridKey(5, 18, 18)],
	tiles: [
		fcover_, fcover_, fcover_, fcover_, empty__, empty__, empty__, empty__, empty__, empty__, empty__, empty__, empty__, fcover_, fcover_, fcover_, fcover_, fcover_,
		empty__, empty__, empty__, empty__, empty__, empty__, empty__, empty__, empty__, empty__, empty__, empty__, empty__, empty__, empty__, empty__, empty__, fcover_,
		empty__, empty__, empty__, empty__, empty__, spawn__, spawn__, empty__, empty__, empty__, spawn__, spawn__, empty__, empty__, empty__, empty__, empty__, empty__,
		empty__, empty__, empty__, empty__, empty__, empty__, empty__, empty__, empty__, empty__, empty__, empty__, empty__, empty__, empty__, empty__, empty__, empty__,
		empty__, empty__, empty__, hcover_, hcover_, empty__, hcover_, hcover_, hcover_, hcover_, hbound_, empty__, hcover_, hcover_, empty__, empty__, empty__, empty__,
		empty__, empty__, vbound_, vbound_, empty__, empty__, empty__, empty__, empty__, empty__, hbound_, empty__, empty__, empty__, empty__, empty__, empty__, empty__,
		empty__, empty__, empty__, empty__, empty__, empty__, empty__, empty__, empty__, empty__, empty__, empty__, empty__, empty__, hcover_, empty__, empty__, empty__,
		empty__, spawn__, empty__, empty__, empty__, empty__, empty__, empty__, empty__, empty__, empty__, empty__, empty__, empty__, empty__, empty__, spawn__, empty__,
		empty__, spawn__, empty__, empty__, empty__, empty__, empty__, empty__, empty__, empty__, empty__, empty__, empty__, empty__, empty__, empty__, spawn__, empty__,
		empty__, empty__, vbound_, vbound_, empty__, empty__, empty__, bosssub, bosssub, bosssub, empty__, empty__, empty__, empty__, hcover_, empty__, empty__, empty__,
		empty__, empty__, hcover_, empty__, empty__, empty__, empty__, bosssub, bossman, bosssub, empty__, empty__, empty__, empty__, hcover_, empty__, empty__, empty__,
		empty__, empty__, hcover_, empty__, empty__, empty__, empty__, bosssub, bosssub, bosssub, empty__, empty__, empty__, vbound_, vbound_, empty__, empty__, empty__,
		empty__, spawn__, empty__, empty__, empty__, empty__, empty__, empty__, empty__, empty__, empty__, empty__, empty__, empty__, empty__, empty__, spawn__, empty__,
		empty__, spawn__, empty__, empty__, empty__, empty__, empty__, empty__, empty__, empty__, empty__, empty__, empty__, empty__, empty__, empty__, spawn__, empty__,
		empty__, empty__, hcover_, empty__, empty__, empty__, empty__, empty__, empty__, empty__, empty__, empty__, empty__, empty__, empty__, empty__, empty__, empty__,
		empty__, empty__, empty__, hbound_, empty__, empty__, empty__, empty__, empty__, empty__, empty__, empty__, empty__, vbound_, vbound_, empty__, empty__, empty__,
		empty__, empty__, empty__, hbound_, hcover_, hcover_, empty__, hcover_, hcover_, hcover_, empty__, hcover_, hcover_, hcover_, empty__, empty__, empty__, empty__,
		empty__, empty__, empty__, empty__, empty__, empty__, empty__, empty__, empty__, empty__, empty__, empty__, empty__, empty__, empty__, empty__, empty__, empty__,
		empty__, empty__, empty__, empty__, empty__, spawn__, spawn__, empty__, empty__, empty__, spawn__, spawn__, empty__, empty__, empty__, empty__, empty__, empty__,
		empty__, empty__, empty__, empty__, empty__, empty__, empty__, empty__, empty__, empty__, empty__, empty__, empty__, empty__, empty__, empty__, empty__, fcover_,
		fcover_, fcover_, fcover_, fcover_, empty__, empty__, empty__, empty__, empty__, empty__, empty__, empty__, empty__, fcover_, fcover_, fcover_, fcover_, fcover_,
		fcover_, fcover_, fcover_, fcover_, fcover_, fcover_, fcover_, empty__, empty__, empty__, fcover_, fcover_, fcover_, fcover_, fcover_, fcover_, fcover_, fcover_,
	]}, {id: "tuskBeasteel", name: "Tusk Beasteel", width: 21, height: 21, locked: true,
	priority:[],
	tiles: [
		empty__, empty__, empty__, empty__, empty__, empty__, empty__, empty__, empty__, empty__, empty__, empty__, empty__, empty__, empty__, empty__, empty__, empty__, empty__, empty__, empty__,
		empty__, empty__, empty__, empty__, empty__, empty__, empty__, empty__, empty__, empty__, empty__, empty__, empty__, empty__, empty__, empty__, empty__, empty__, empty__, empty__, empty__,
		empty__, empty__, empty__, empty__, empty__, empty__, empty__, empty__, empty__, empty__, empty__, empty__, empty__, empty__, empty__, empty__, empty__, empty__, empty__, empty__, empty__,
		empty__, empty__, empty__, hcover_, hcover_, hcover_, empty__, empty__, empty__, hbound_, hbound_, hbound_, empty__, empty__, empty__, hcover_, hcover_, hcover_, empty__, empty__, empty__,
		empty__, empty__, empty__, hcover_, empty__, empty__, empty__, empty__, empty__, hbound_, hbound_, hbound_, empty__, empty__, empty__, empty__, empty__, hcover_, empty__, empty__, empty__,
		empty__, empty__, empty__, hcover_, empty__, empty__, empty__, spawn__, empty__, empty__, spawn__, empty__, empty__, spawn__, hcover_, empty__, empty__, hcover_, empty__, empty__, empty__,
		empty__, empty__, empty__, hcover_, empty__, empty__, hcover_, hcover_, hbound_, empty__, empty__, empty__, hbound_, hbound_, hcover_, empty__, empty__, hcover_, empty__, empty__, empty__,
		empty__, empty__, empty__, empty__, empty__, empty__, hcover_, empty__, hbound_, empty__, empty__, empty__, hbound_, hbound_, empty__, empty__, empty__, hcover_, empty__, empty__, empty__,
		empty__, empty__, empty__, empty__, empty__, spawn__, hcover_, empty__, empty__, empty__, empty__, empty__, empty__, empty__, empty__, spawn__, fcover_, empty__, empty__, empty__, empty__,
		empty__, empty__, empty__, empty__, empty__, empty__, hcover_, empty__, empty__, bosssub, bosssub, bosssub, empty__, empty__, empty__, empty__, fcover_, empty__, empty__, empty__, empty__,
		empty__, empty__, empty__, empty__, empty__, empty__, empty__, empty__, empty__, bosssub, bossman, bosssub, empty__, empty__, empty__, empty__, empty__, empty__, empty__, empty__, empty__,
		empty__, empty__, empty__, empty__, fcover_, empty__, empty__, empty__, empty__, bosssub, bosssub, bosssub, empty__, empty__, hcover_, empty__, empty__, empty__, empty__, empty__, empty__,
		empty__, empty__, empty__, empty__, fcover_, spawn__, empty__, empty__, empty__, empty__, empty__, empty__, empty__, empty__, hcover_, spawn__, empty__, empty__, empty__, empty__, empty__,
		empty__, empty__, empty__, hcover_, empty__, empty__, empty__, hbound_, hbound_, empty__, empty__, empty__, hbound_, empty__, hcover_, empty__, empty__, empty__, empty__, empty__, empty__,
		empty__, empty__, empty__, hcover_, empty__, empty__, hcover_, hbound_, hbound_, empty__, empty__, empty__, hbound_, hcover_, hcover_, empty__, empty__, hcover_, empty__, empty__, empty__,
		empty__, empty__, empty__, hcover_, empty__, empty__, hcover_, spawn__, empty__, empty__, spawn__, empty__, empty__, spawn__, empty__, empty__, empty__, hcover_, empty__, empty__, empty__,
		empty__, empty__, empty__, hcover_, empty__, empty__, empty__, empty__, empty__, hbound_, hbound_, hbound_, empty__, empty__, empty__, empty__, empty__, hcover_, empty__, empty__, empty__,
		empty__, empty__, empty__, hcover_, hcover_, hcover_, empty__, empty__, empty__, hbound_, hbound_, hbound_, empty__, empty__, empty__, hcover_, hcover_, hcover_, empty__, empty__, empty__,
		empty__, empty__, empty__, empty__, empty__, empty__, empty__, empty__, empty__, empty__, empty__, empty__, empty__, empty__, empty__, empty__, empty__, empty__, empty__, empty__, empty__,
		empty__, empty__, empty__, empty__, empty__, empty__, empty__, empty__, empty__, empty__, empty__, empty__, empty__, empty__, empty__, empty__, empty__, empty__, empty__, empty__, empty__,
		empty__, empty__, empty__, empty__, empty__, empty__, empty__, empty__, empty__, empty__, empty__, empty__, empty__, empty__, empty__, empty__, empty__, empty__, empty__, empty__, empty__
	]}, {id: "bladeGuardTitan", name:"Blade Guard Titan", width: 16, height: 16, locked: true,
		priority:[gridKey(4, 6, 16), gridKey(4, 8, 16), gridKey(9, 11, 16), gridKey(7, 11, 16), gridKey(8, 13, 16), gridKey(2, 7, 16), gridKey(14, 7, 16), gridKey(12, 8, 16), gridKey(12, 6, 16), gridKey(8, 1, 16), gridKey(7, 3, 16), gridKey(9, 3, 16)],
		tiles: [
		empty__, empty__, empty__, empty__, empty__, empty__, empty__, empty__, empty__, empty__, empty__, vbound_, vbound_, empty__, empty__, empty__,
		empty__, empty__, empty__, empty__, hcover_, empty__, empty__, empty__, spawn__, empty__, empty__, vbound_, vbound_, empty__, empty__, empty__,
		empty__, empty__, hbound_, hbound_, hcover_, empty__, empty__, empty__, hcover_, empty__, empty__, empty__, fcover_, fcover_, empty__, empty__,
		empty__, empty__, hbound_, hbound_, empty__, empty__, hcover_, hspawn_, empty__, hspawn_, hcover_, empty__, empty__, empty__, empty__, empty__,
		empty__, empty__, empty__, empty__, empty__, empty__, empty__, hbound_, hbound_, hbound_, empty__, empty__, empty__, empty__, empty__, empty__,
		empty__, empty__, empty__, empty__, hcover_, empty__, empty__, empty__, hbound_, empty__, empty__, empty__, hcover_, empty__, empty__, empty__,
		empty__, empty__, empty__, empty__, vspawn_, vbound_, empty__, bosssub, bosssub, bosssub, empty__, vbound_, vspawn_, empty__, empty__, empty__,
		empty__, empty__, spawn__, hcover_, empty__, vbound_, vbound_, bosssub, bossman, bosssub, vbound_, vbound_, empty__, hcover_, spawn__, empty__,
		empty__, empty__, empty__, empty__, vspawn_, vbound_, empty__, bosssub, bosssub, bosssub, empty__, vbound_, vspawn_, empty__, empty__, empty__,
		empty__, empty__, empty__, empty__, hcover_, empty__, empty__, empty__, hbound_, empty__, empty__, empty__, hcover_, empty__, empty__, empty__,
		empty__, empty__, empty__, empty__, empty__, empty__, empty__, hbound_, hbound_, hbound_, empty__, empty__, empty__, empty__, empty__, empty__,
		empty__, empty__, empty__, empty__, empty__, empty__, hcover_, hspawn_, empty__, hspawn_, hcover_, empty__, empty__, hbound_, hbound_, empty__,
		empty__, empty__, empty__, fcover_, fcover_, empty__, empty__, empty__, hcover_, empty__, empty__, empty__, hcover_, hbound_, hbound_, empty__,
		empty__, empty__, empty__, empty__, vbound_, vbound_, empty__, empty__, spawn__, empty__, empty__, empty__, hcover_, empty__, empty__, empty__,
		empty__, empty__, empty__, empty__, vbound_, vbound_, empty__, empty__, empty__, empty__, empty__, empty__, empty__, empty__, empty__, empty__,
		empty__, empty__, empty__, empty__, empty__, empty__, empty__, empty__, empty__, empty__, empty__, empty__, empty__, empty__, empty__, empty__
	]}];

function emptyMap(width: number, height: number) {
	return Array(width * height).fill(empty__) as TileType[];
}

export function isBuiltInMap(name: string): boolean {
	return maps.some((map) => map.name === name);
}

export function builtInMaps(): readonly MapGrid[] {
	return maps;
}

/** The map called `name`: a built-in, else the timeline's own copy (`customMap`), else a slot. */
export function findMap(name: string, customMap: MapGrid | undefined = state.customMap): MapGrid | undefined {
	return (
		maps.find((map) => map.name === name) ??
		(customMap?.name === name ? customMap : undefined) ??
		slots().find((map): map is MapGrid => map?.name === name)
	);
}

export function isKnownMap(name: string, customMap?: MapGrid): boolean {
	return findMap(name, customMap) !== undefined;
}

export function getMapByName(name: string, customMap?: MapGrid): MapGrid {
	const map = findMap(name, customMap);
	if (!map) throw new Error(`Map ${name} not found`);
	return map;
}

export function getDefaultMap() {
	for (const map of maps) {
		if (map.default) {
			return map;
		}
	}
	return maps[0];
}

/** Switches the timeline to the map called `name` (see findMap); unknown names are ignored. */
export function loadMap(name: string) {
	const map = findMap(name);
	if (map) selectMap(map);
}

/** Switches the timeline to `map`, keeping a copy of it in the timeline when it's a custom map. */
export function selectMap(map: MapGrid) {
	const copy = isBuiltInMap(map.name) ? undefined : toPlainMap(map);
	setState(
		produce((s) => {
			s.map = map.name;
			if (copy) s.customMap = copy;
			else delete s.customMap;
		})
	);
	fillGrid(map);
}

/** Only the fields a map is shared with, as fresh arrays (also unwraps store proxies, which can't be cloned). */
export function toPlainMap(map: MapGrid): MapGrid {
	return { id: map.id, name: map.name, width: map.width, height: map.height, priority: [...map.priority], tiles: [...map.tiles] };
}

export function newMapId() {
	return `custom-${Math.random().toString(36).slice(2, 10)}`;
}

// ---- Slots ----

const [slotMaps, setSlotMaps] = createSignal<(MapGrid | null)[]>(Array(MAP_SLOT_COUNT).fill(null) as null[]);
/** The custom map in each local slot, or null for an empty slot */
export const slots = slotMaps;

export function slotLabel(index: number, map: MapGrid) {
	return `Slot ${index + 1}: ${map.name}`;
}

export interface MapChoice {
	label: string;
	map: MapGrid;
}

/** The maps the timeline can use: built-ins, filled slots, then the timeline's own map when it isn't in a slot. */
export function mapChoices(): MapChoice[] {
	const choices: MapChoice[] = maps.map((map) => ({ label: map.name, map }));
	for (const [index, map] of slots().entries()) if (map) choices.push({ label: slotLabel(index, map), map });
	if (state.customMap && !isBuiltInMap(state.map) && timelineSlot() === -1) {
		choices.push({ label: timelineMapLabel(state.customMap), map: state.customMap });
	}
	return choices;
}

function timelineMapLabel(map: MapGrid) {
	return `This timeline: ${map.name}`;
}

/** How the timeline's current map appears in `mapChoices` */
export function currentMapLabel(): string {
	if (isBuiltInMap(state.map) || !state.customMap) return state.map;
	const index = timelineSlot();
	const slot = index > -1 ? slots()[index] : null;
	return slot ? slotLabel(index, slot) : timelineMapLabel(state.customMap);
}

/** Reads the slots from storage; the first time, a map from the old single-map editor moves into slot 1. */
export function loadSlots() {
	const stored = localStorageLoad(CUSTOM_MAP_SLOTS_KEY);
	const list = Array.from({ length: MAP_SLOT_COUNT }, (_, i): MapGrid | null => {
		const raw: unknown = Array.isArray(stored) ? (stored as unknown[])[i] : null;
		if (raw == null) return null;
		try {
			return checkMap(raw);
		} catch (e) {
			log.warn(`Custom map slot ${i + 1} couldn't be read, so it was left empty`, e);
			return null;
		}
	});
	if (!list.some((map) => map !== null)) {
		const legacy = localStorageLoad(V7_EDITOR_MAP_KEY);
		if (legacy != null) {
			try {
				const map = checkMap(legacy);
				map.id = newMapId();
				map.name = uniqueMapName(map.name, list);
				list[0] = map;
				localStorage.setItem(CUSTOM_MAP_SLOTS_KEY, JSON.stringify(list));
			} catch (e) {
				log.warn("The old custom map couldn't be read, so it wasn't moved into a slot", e);
			}
		}
	}
	setSlotMaps(list);
}

/** Stores `map` in slot `index`; while the timeline uses the same map (same id), its copy follows along. */
export function saveSlot(index: number, map: MapGrid) {
	const copy = toPlainMap(map);
	const list = [...slots()];
	list[index] = copy;
	setSlotMaps(list);
	localStorage.setItem(CUSTOM_MAP_SLOTS_KEY, JSON.stringify(list));
	if (state.customMap?.id === copy.id && !isBuiltInMap(state.map)) {
		setState(
			produce((s) => {
				s.map = copy.name;
				s.customMap = toPlainMap(copy);
			})
		);
		saveToLocalStorage();
	}
}

/** Empties slot `index`; a timeline using its map keeps its own copy. */
export function clearSlot(index: number) {
	const list = [...slots()];
	list[index] = null;
	setSlotMaps(list);
	localStorage.setItem(CUSTOM_MAP_SLOTS_KEY, JSON.stringify(list));
}

/** The slot holding the timeline's custom map, or -1 when it isn't in any slot (or the map is built in). */
export function timelineSlot(): number {
	const id = state.customMap?.id;
	if (id === undefined || isBuiltInMap(state.map)) return -1;
	return slots().findIndex((map) => map?.id === id);
}

/** Why `name` can't be used for the map in slot `index`, or null when it can. */
export function mapNameProblem(name: string, index: number): string | null {
	const trimmed = name.trim();
	if (!trimmed) return "Give the map a name";
	if (trimmed.length > 40) return "Keep the name to 40 characters or fewer";
	if (isBuiltInMap(trimmed)) return `"${trimmed}" is already a built-in map`;
	if (slots().some((map, i) => i !== index && map?.name === trimmed)) return `Another slot already has a map called "${trimmed}"`;
	return null;
}

/** `name`, or `name (2)`, `name (3)`… if a built-in map or another slot already uses it. */
export function uniqueMapName(name: string, others: readonly (MapGrid | null)[] = slots(), skip = -1): string {
	const base = name.trim().slice(0, 36) || "Custom Map";
	const taken = (candidate: string) => isBuiltInMap(candidate) || others.some((map, i) => i !== skip && map?.name === candidate);
	if (!taken(base)) return base;
	let n = 2;
	while (taken(`${base} (${n})`)) n++;
	return `${base} (${n})`;
}

// ---- Editor ----

/** The slot open in the map editor, or null while the slot picker is shown */
export const [editingSlot, setEditingSlot] = createSignal<number | null>(null);

export function newBlank(name: string, width: number, height: number): MapGrid {
	return { id: newMapId(), name: name.trim(), width, height, priority: [], tiles: emptyMap(width, height) };
}

/** A copy of `map` to edit, with its own id so the original (built-in or slot) stays unchanged. */
export function copyFrom(map: MapGrid, name: string): MapGrid {
	return { ...toPlainMap(map), id: newMapId(), name: name.trim() };
}

/** The map as plain JSON, the same shape as the built-in maps; `parseMapJson` reads it back. */
export function exportJson(map: MapGrid = mapGrid): string {
	return JSON.stringify(toPlainMap(map), null, 0);
}

/** Reads a map exported by `exportJson`, with a fresh id; throws a readable error when it isn't one. */
export function parseMapJson(text: string): MapGrid {
	let raw: unknown;
	try {
		raw = JSON.parse(text);
	} catch {
		throw new Error("That isn't valid JSON");
	}
	const map = checkMap(raw);
	map.id = newMapId();
	return map;
}

/** Every TileType flag set at once */
const ALL_TILE_BITS = 127;

/** `raw` as a map, keeping its id, with priorities that don't point at a spawn dropped; throws when it isn't one. */
export function checkMap(raw: unknown): MapGrid {
	if (typeof raw !== "object" || raw === null || Array.isArray(raw)) throw new Error("That isn't a map");
	const data = raw as Record<string, unknown>;
	const { width, height, tiles, priority } = data;
	const isSize = (n: unknown): n is number => typeof n === "number" && Number.isInteger(n) && n >= MIN_MAP_SIZE && n <= MAX_MAP_SIZE;
	if (!isSize(width) || !isSize(height)) {
		throw new Error(`"width" and "height" must be whole numbers from ${MIN_MAP_SIZE} to ${MAX_MAP_SIZE}`);
	}
	if (!Array.isArray(tiles) || tiles.length !== width * height) {
		throw new Error(`"tiles" must list ${width * height} tiles (width × height)`);
	}
	const isTile = (tile: unknown): tile is TileType => typeof tile === "number" && Number.isInteger(tile) && tile >= 0 && tile <= ALL_TILE_BITS;
	if (!tiles.every(isTile)) throw new Error(`"tiles" has an unknown tile type`);
	const typed = tiles;
	if (typed.filter((tile) => isTileType(tile, TileType.BossOrigin)).length > 1) throw new Error("A map can only have one boss");
	const name = typeof data.name === "string" && data.name.trim() ? data.name.trim().slice(0, 40) : "Custom Map";
	const ranks: unknown[] = Array.isArray(priority) ? priority : [];
	const cleanPriority = ranks.filter(
		(index, i): index is number =>
			typeof index === "number" &&
			Number.isInteger(index) &&
			index >= 0 &&
			index < typed.length &&
			isTileType(typed[index], TileType.Spawn) &&
			ranks.indexOf(index) === i
	);
	const id = typeof data.id === "string" && data.id ? data.id : newMapId();
	return { id, name, width, height, priority: cleanPriority, tiles: [...typed] };
}
