import { gridKey, mapGrid, setMap } from "../store";
import { V7_EDITOR_MAP_KEY } from "../types/constants";
import { MapGrid, TileType } from "../types";
import { createSignal } from "solid-js";

export const [editingMap, setEditingMap] = createSignal("Broken-Horn Beasteel");

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
const maps: MapGrid[] = [{name:"Temblor Titan", width:15, height:15, locked: true, default: true,
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
	]},{name:"Broken-Horn Beasteel", width:18, height:22, locked: true, default: false,
		priority:[gridKey(13, 1, 18), gridKey(12, 1, 18), gridKey(8, 1, 18), gridKey(7, 1, 18), gridKey(2, 5, 18), gridKey(2, 6, 18), gridKey(2, 10, 18), gridKey(2, 11, 18), gridKey(7, 16, 18), gridKey(8, 16, 18), gridKey(12, 16, 18), gridKey(13, 16, 18), gridKey(18, 11, 18), gridKey(18, 10, 18), gridKey(18, 6, 18), gridKey(18, 5, 18)],
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
	]}, {name: "Tusk Beasteel", width: 21, height: 21, locked: true,
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
	]}, {name:"Blade Guard Titan", width: 16, height: 16, locked: true,
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
	]}, {name: "Custom", width: 21, height: 21, priority:[],tiles:Array(21*21).fill(empty__)}];

export function getDefaultMap() {
	for (const map of maps) {
		if (map.default) {
			return map;
		}
	}
	return maps[0];
}

export function mapNames() {
	return maps.map((map) => map.name);
}

export function loadMap(name: string) {
	const map = maps.find((map) => map.name === name);
	if (map) {
		setEditingMap(name);
		setMap(map.name, map.width, map.height, map.tiles, map.priority ?? []);
	}
}

export function editorSerialize() {
	for (const map of maps) {
		if (map.name === editingMap()) {
			return JSON.stringify(map);
		}
	}
	return "";
}

export function editorDeserialize(text: string) {
	try {
		const data: MapGrid = JSON.parse(text);
		const oldCustomMap = maps.find((map) => map.name === "Custom");
		if (oldCustomMap) {
			maps.splice(maps.indexOf(oldCustomMap), 1);
		}
		maps.push(data);
		return;
	} catch {}
}

export function saveEditorMap() {
	for (const map of maps) {
		if (map.name === "Custom") {
			localStorage.setItem(V7_EDITOR_MAP_KEY, JSON.stringify(map));
		}
	}
}

export function loadEditorMap() {
	const saved = localStorage.getItem(V7_EDITOR_MAP_KEY);
	if (saved) {
		try {
			const data: MapGrid = JSON.parse(saved);
			const oldCustomMap = maps.find((map) => map.name === "Custom");
			if (oldCustomMap) {
				maps.splice(maps.indexOf(oldCustomMap), 1);
			}
			maps.push(data);
			return;
		} catch {}
	}
	editorResetLayout();
}

export function editorClearAll() {
	mapGrid.tiles.length = 0;
}

export function editorResetLayout() {
	editorClearAll();
	const defaultMap = getDefaultMap();
	setMap(defaultMap.name, defaultMap.width, defaultMap.height, defaultMap.tiles, defaultMap.priority);
}
