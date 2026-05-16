import { mapGrid, setMap } from "../store";
import { V7_EDITOR_MAP_KEY } from "../types/constants";
import { MapGrid, TileType } from "../types";
import { createSignal } from "solid-js";

export const [editingMap, setEditingMap] = createSignal("Blade Guard Titan");

const empty__ = TileType.Empty;
const spawn__ = TileType.Spawn;
const hbound_ = TileType.HBoundary;
const hspawn_ = TileType.HBoundary | TileType.Spawn;
const vbound_ = TileType.VBoundary;
const vspawn_ = TileType.VBoundary | TileType.Spawn;
const hcover_ = TileType.HalfCover;
const fcover_ = TileType.FullCover;
const bosssub = TileType.BossCover;
const bossman = TileType.BossOrigin;

// prettier-ignore
const maps: MapGrid[] = [{name: "Tusk Beasteel", size: 21, locked: true, tiles: [
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
	]}, {name:"Blade Guard Titan", size: 16, locked: true, default: true, tiles: [
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
	]}, {name: "Custom", size: 21, tiles:Array(21*21).fill(empty__)}];

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
		setMap(map.name, map.size, map.tiles);
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
	setMap(defaultMap.name, defaultMap.size, defaultMap.tiles);
}
