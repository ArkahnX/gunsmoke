import { MapBounds } from ".";

export const MAP_SIZE = 21;
export const TILE_SIZE = 32;
export const SCALE = 2;
export const CANVAS_SIZE = MAP_SIZE * TILE_SIZE;

export const E_PAD = 6;
export const HALF_HEIGHT = Math.round(TILE_SIZE * 0.15);
export const FULL_HEIGHT = Math.round(TILE_SIZE * 0.35);

export const SAVE_VERSION = 7;
export const STORAGE_KEY = "arenaPlannerState_v" + SAVE_VERSION;
export const EDITOR_MAP_KEY = "arenaEditorMap_v1";
export const SKILL_DISPLAY_KEY = "arenaSkillDisplay_v1";

export const MIN_SCALE = 0.25; // never zoom out further than this
export const MAX_SCALE = 10;

// The world-space boundary of the entire map
export const MAP_BOUNDS: MapBounds = {
	minX: 0,
	minY: 0,
	maxX: MAP_SIZE * TILE_SIZE,
	maxY: MAP_SIZE * TILE_SIZE,
};
