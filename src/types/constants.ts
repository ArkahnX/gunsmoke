import { MapBounds } from ".";
import { IdKey, KeyType } from "../../gfl2-data/enums";
import { SkillId } from "../../gfl2-data/types";

export const MAP_WIDTH = 18;
export const MAP_HEIGHT = 22;
export const TILE_SIZE = 32;
export const SCALE = 2;
/** Largest custom map, in tiles along either side; keeps maps embedded in shared timelines small */
export const MAX_MAP_SIZE = 25;
/** Smallest custom map: room for the 3×3 boss */
export const MIN_MAP_SIZE = 3;
/** Custom maps the player can keep locally */
export const MAP_SLOT_COUNT = 5;

export const E_PAD = 6;
export const HALF_HEIGHT = Math.round(TILE_SIZE * 0.15);
export const FULL_HEIGHT = Math.round(TILE_SIZE * 0.35);

export const END_TURN_SKILL_ID = -1;

/** Every fortification level a doll can have (V0-V6) */
export const FORTIFICATION_LEVELS = [0, 1, 2, 3, 4, 5, 6];
/** Key slot types in display order: 3 fixed, 1 expansion, 1 affinity, 3 common */
export const KEY_SLOTS = [
	KeyType.FixedKey,
	KeyType.FixedKey,
	KeyType.FixedKey,
	KeyType.ExpansionKey,
	KeyType.AffinityKey,
	KeyType.CommonKey,
	KeyType.CommonKey,
	KeyType.CommonKey,
];
/**
 * Extra copies of a key the player can own beyond the first, by key type; only types listed here are limited (fixed and
 * expansion keys belong to one doll). Read through `maxKeyHolders` (store/keys.ts).
 */
export const EXTRA_KEY_COPIES: Partial<Record<KeyType, number>> = {
	[KeyType.CommonKey]: 0,
	[KeyType.AffinityKey]: 0,
};
/** Most dolls a team can have */
export const MAX_TEAM_SIZE = 5;
/** Every remolding level a doll can have */
export const REMOLDING_LEVELS = [1, 10, 20, 30, 45, 60];
export const V9_END_TURN_SKILL_ID: SkillId = `${IdKey.Skills}-1`;

// version 7 keys
export const V7_SAVE_VERSION = 7;
export const V7_STORAGE_KEY = "arenaPlannerState_v" + String(V7_SAVE_VERSION);
export const V7_EDITOR_MAP_KEY = "arenaEditorMap_v2";
export const V7_SKILL_DISPLAY_KEY = "arenaSkillDisplay_v1";

// version 8 keys
export const V8_SAVE_VERSION = 8;
export const V8_STORAGE_KEY = "gunsmoke_state_v" + String(V8_SAVE_VERSION);
export const V8_SKILL_DISPLAY_KEY = "gunsmoke_skills_v" + String(V8_SAVE_VERSION); // superceded by localState V9_LOCAL_STATE
export const V8_DOLL_LOADOUT_KEY = (dollId: string) => `gunsmoke_doll_${dollId}_v${V8_SAVE_VERSION}`;
export const V8_CUSTOM_MAP_KEY = "gunsmoke_custom_map_v" + String(V8_SAVE_VERSION);

// version 9 keys
export const V9_SAVE_VERSION = 9;
export const V9_STORAGE_KEY = "gunsmoke_state_v" + String(V9_SAVE_VERSION);
export const V9_LOCAL_STATE = "gunsmoke_localstate_v" + String(V9_SAVE_VERSION);
export const V9_DOLL_LOADOUT_KEY = (dollId: string) => `gunsmoke_doll_${dollId}_v${V9_SAVE_VERSION}`;

// version 10 keys
export const V10_SAVE_VERSION = 10;
export const V10_STORAGE_KEY = "gunsmoke_state_v" + String(V10_SAVE_VERSION);
export const V10_LOCAL_STATE = "gunsmoke_localstate_v" + String(V10_SAVE_VERSION);
export const V10_DOLL_LOADOUT_KEY = (dollId: string) => `gunsmoke_doll_${dollId}_v${V10_SAVE_VERSION}`;

// version agnostic keys
export const SAVED_STATES_KEY = "gunsmoke_state_ids";
/** `(MapGrid | null)[]`, one entry per custom map slot */
export const CUSTOM_MAP_SLOTS_KEY = "gunsmoke_custom_maps";
export const FAILED_STATE_BACKUP_KEY = "gunsmoke_failed_state_backup";

export const MIN_SCALE = 0.25; // never zoom out further than this
export const MAX_SCALE = 10;

// The world-space boundary of the entire map
export const MAP_BOUNDS: MapBounds = {
	minX: 0,
	minY: 0,
	maxX: MAP_WIDTH * TILE_SIZE,
	maxY: MAP_HEIGHT * TILE_SIZE,
};
