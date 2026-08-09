import { MapBounds } from ".";

export const MAP_WIDTH = 18;
export const MAP_HEIGHT = 22;
export const TILE_SIZE = 32;
export const SCALE = 2;
export const CANVAS_WIDTH = MAP_WIDTH * TILE_SIZE;
export const CANVAS_HEIGHT = MAP_HEIGHT * TILE_SIZE;

export const E_PAD = 6;
export const HALF_HEIGHT = Math.round(TILE_SIZE * 0.15);
export const FULL_HEIGHT = Math.round(TILE_SIZE * 0.35);
export const CURRENT_SEASON = 29;

// version 7 keys
export const V7_SAVE_VERSION = 7;
export const V7_STORAGE_KEY = "arenaPlannerState_v" + V7_SAVE_VERSION;
export const V7_EDITOR_MAP_KEY = "arenaEditorMap_v2";
export const V7_SKILL_DISPLAY_KEY = "arenaSkillDisplay_v1";

// version 8 keys
export const SAVE_VERSION = 8;
export const SAVED_STATES_KEY = "gunsmoke_state_ids";
export const STORAGE_KEY = "gunsmoke_state_v" + SAVE_VERSION;
export const SKILL_DISPLAY_KEY = "gunsmoke_skills_v" + SAVE_VERSION;
export const DOLL_LOADOUT_KEY = (dollId: string) => `gunsmoke_doll_${dollId}_v${SAVE_VERSION}`;
export const CUSTOM_MAP_KEY = "gunsmoke_custom_map_v" + SAVE_VERSION;

export const MIN_SCALE = 0.25; // never zoom out further than this
export const MAX_SCALE = 10;

// The world-space boundary of the entire map
export const MAP_BOUNDS: MapBounds = {
	minX: 0,
	minY: 0,
	maxX: MAP_WIDTH * TILE_SIZE,
	maxY: MAP_HEIGHT * TILE_SIZE,
};
