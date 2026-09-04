import { createStore, produce, unwrap } from "solid-js/store";
import { createMemo, createSignal } from "solid-js";
import {
	type AppState,
	type DollData,
	type SummonData,
	type EditorTool,
	type SelectedDoll,
	type SkillAction,
	type Position,
	type TabData,
	type RawDollEntry,
	type KeyData,
	type DragState,
	TileType,
	MapGrid,
	WeaponData,
	FixedKey,
	SkillDisplay,
	RawKeyData,
	DetailedKey,
	BuffData,
	ApiResponse,
	StateEntry,
	Effect,
} from "../types";
import { loadMap, setEditingMap } from "../canvas/editorMap";
import {
	CURRENT_SEASON,
	CUSTOM_MAP_KEY,
	DOLL_LOADOUT_KEY,
	SAVE_VERSION,
	SAVED_STATES_KEY,
	SKILL_DISPLAY_KEY,
	STORAGE_KEY,
	TILE_SIZE,
	V7_EDITOR_MAP_KEY,
	V7_SAVE_VERSION,
	V7_SKILL_DISPLAY_KEY,
	V7_STORAGE_KEY,
} from "../types/constants";
import { camera } from "../components/ArenaCanvas";

// ====================== MAP GRID ======================
export const mapGrid: MapGrid = { name: "Default", width: 21, height: 21, priority: [], tiles: [] };

export function pathfindingGrid() {
	const tiles = [];
	for (let row = 0; row < mapGrid.height; row++) {
		const rows = [];
		for (let col = 0; col < mapGrid.width; col++) {
			const tile = mapGrid.tiles[gridKey(col, row)];
			if (
				isTileType(tile, TileType.BossCover) ||
				isTileType(tile, TileType.BossOrigin) ||
				isTileType(tile, TileType.FullCover) ||
				isTileType(tile, TileType.HalfCover)
			) {
				rows.push(1);
			} else {
				rows.push(0);
			}
		}
		tiles.push(rows);
	}
	return tiles;
}

export function gridKey(column: number, row: number, width?: number): number {
	return row * (width ?? mapGrid.width) + column;
}
export function cellX(c: number): number {
	return c * TILE_SIZE;
}
export function cellY(r: number): number {
	return r * TILE_SIZE;
}
export function cellCenter(c: number): number {
	return c * TILE_SIZE + TILE_SIZE / 2;
}
export function inMapBounds(c: number, r: number): boolean {
	return c >= 0 && c < mapGrid.height && r >= 0 && r < mapGrid.width;
}
export function isTileType(tile: TileType, type: TileType): boolean {
	return (tile & type) === type;
}
export function getCell(column: number, row: number): TileType {
	if (row > mapGrid.width || column > mapGrid.height) {
		console.error("Out of bound tile", column, row, mapGrid.size);
		return TileType.Empty;
	}
	return mapGrid.tiles[row * mapGrid.width + column];
}
export function getBoss() {
	const bossIndex = mapGrid.tiles.findIndex((tile) => isTileType(tile, TileType.BossOrigin));
	if (bossIndex > -1) {
		return { x: bossIndex % mapGrid.width, y: Math.floor(bossIndex / mapGrid.height) };
	}
	return { x: 0, y: 0 };
}
export function hasCover(c: number, r: number): boolean {
	if (!inMapBounds(c, r)) return false;
	const cell = mapGrid.tiles[gridKey(c, r)];
	return (
		isTileType(cell, TileType.FullCover) ||
		isTileType(cell, TileType.HalfCover) ||
		isTileType(cell, TileType.BossCover) ||
		isTileType(cell, TileType.BossOrigin)
	);
}

export function setMap(name: string, width: number, height: number, tiles: TileType[], priority: number[]) {
	setState("map", name);
	mapGrid.name = name;
	mapGrid.width = width;
	mapGrid.height = height;
	mapGrid.tiles.length = 0;
	mapGrid.priority.length = 0;
	mapGrid.priority.push(...priority);
	mapGrid.tiles.push(...tiles);
	camera.x = (mapGrid.width * TILE_SIZE) / 2;
	camera.y = (mapGrid.height * TILE_SIZE) / 2;
}

export function setCell(x: number, y: number, value: TileType, merge?: boolean) {
	const before = getCell(x, y);
	if (merge) {
		mapGrid.tiles[gridKey(x, y)] = mapGrid.tiles[gridKey(x, y)] | value;
	}
	mapGrid.tiles[gridKey(x, y)] = value;
}

export function unsetBoss() {
	for (const [index, tile] of mapGrid.tiles.entries()) {
		if (isTileType(tile, TileType.BossCover) || isTileType(tile, TileType.BossOrigin)) {
			mapGrid.tiles[index] = mapGrid.tiles[index] & ~TileType.BossCover;
			mapGrid.tiles[index] = mapGrid.tiles[index] & ~TileType.BossOrigin;
		}
	}
}

function debugCell(tile: TileType) {
	const results = [
		isTileType(tile, TileType.Empty) ? "Empty" : "",
		isTileType(tile, TileType.HBoundary) ? "HBoundary" : "",
		isTileType(tile, TileType.VBoundary) ? "VBoundary" : "",
		isTileType(tile, TileType.HalfCover) ? "HalfCover" : "",
		isTileType(tile, TileType.FullCover) ? "FullCover" : "",
		isTileType(tile, TileType.Spawn) ? "Spawn" : "",
		isTileType(tile, TileType.BossCover) ? "BossCover" : "",
		isTileType(tile, TileType.BossOrigin) ? "BossOrigin" : "",
	];
	return results.filter((result) => result.length).join(", ");
}

// ====================== DOLL / SUMMON LISTS ======================
export const allDolls: DollData[] = [];
export const allEffects: Effect[] = [];
export const allSummons: SummonData[] = [];
export const allKeys: KeyData = { common: [], affinity: [] };
export const allWeapons: WeaponData[] = [];
export const allBuffs: BuffData[] = [];
export const defaultWeapons: Record<string, WeaponData> = {};
export const skillOrder = ["Basic Attack", "Skill 1", "Skill 2", "Skill 3", "Passive", "Skill A", "Skill B", "End Turn", "Move"];
export const skillOrderMap: Record<string, number | string> = skillOrder.reduce(
	(previousValue, currentValue, currentIndex) => ({ ...previousValue, [currentValue]: currentIndex, [currentIndex]: currentValue }),
	{}
);
export const notations: Record<string, string[]> = {
	"Basic Attack": ["S1", "1", "BA"],
	"Skill 1": ["S2", "2", "S1"],
	"Skill 2": ["S3", "3", "S2"],
	"Skill 3": ["S4", "4", "ULT"],
	Passive: ["S5", "5", "PSV"],
	"Skill A": ["S6", "6", "SA", "1"],
	"Skill B": ["S7", "7", "SB", "2"],
	"End Turn": ["ET", "Z", "END"],
	Move: ["MV", "W", "MOVE", "MOV"],
};

export const endTurnSkill = {
	id: -1,
	name: "End Turn",
	type: "End Turn",
	range: null,
	tags: [],
	localImagePath: "data/common/end.svg",
};

// ====================== EDITOR STATE ======================
export const [editorTool, setEditorTool] = createSignal<EditorTool>("spawn");
export const [editorStatus, setEditorStatus] = createSignal("Left-click / drag to place · Right-click to erase");
export const [editorCoords, setEditorCoords] = createSignal("");
export const [editorIoMode, setEditorIoMode] = createSignal<"export" | "import">("export");
export const [editorIoText, setEditorIoText] = createSignal("");
export const [showEditorIo, setShowEditorIo] = createSignal(false);
export const [loaded, setLoaded] = createSignal(false);
export const [overrideSkillNotations, setOverrideSkillNotations] = createSignal(false);

// ====================== APP STATE ======================
function makeDefaultTabData(): TabData {
	return { actionOrder: [], actions: {}, dollPositions: {}, summonPositions: [] };
}

export const [tempSelectedDolls, setTempSelectedDolls] = createStore<SelectedDoll[]>([]);

const defaultState: AppState = {
	selectedDolls: [],
	currentTab: 0,
	score: 0,
	description: "",
	map: "Broken-Horn Beasteel",
	buffs: [],
	skillDisplay: [0, 0, 0, 0, 0, 0, 0],
	tabData: Array.from({ length: 8 }, () => makeDefaultTabData()),
};
export const [state, setState] = createStore<AppState>(structuredClone(defaultState));

// ====================== MODAL STATE ======================
export const [showDollModal, setShowDollModal] = createSignal(false);
export const [showFormationModal, setShowFormationModal] = createSignal(false);
export const [showWeaponModal, setShowWeaponModal] = createSignal(false);
export const [showKeyModal, setShowKeyModal] = createSignal(false);
export const [showBuffModal, setShowBuffModal] = createSignal(false);
export const hideFormationModal = createMemo(() => showWeaponModal() || showKeyModal());
export const [selectedDoll, setSelectedDoll] = createSignal<SelectedDoll | null>(null);
export const [showImportModal, setShowImportModal] = createSignal(false);
export const [showExportModal, setShowExportModal] = createSignal(false);
export const [showSkillDisplayModal, setShowSkillDisplayModal] = createSignal(false);
export const [showTargetModal, setShowTargetModal] = createSignal(false);
export const [targetSkillInfo, setTargetSkillInfo] = createSignal("");
export const [targetDollId, setTargetDollId] = createSignal<string | null>(null);
export const [targetSkillId, setTargetSkillId] = createSignal<number | null>(null);
export const [activePhaseTab, setActivePhaseTab] = createSignal<string>("All");
export const [tempSelected, setTempSelected] = createSignal<string[]>([]);
export const [dollFortification, setDollFortification] = createSignal<Record<string, number>>({});
export const [stateHashMatch, setStateHashMatch] = createSignal(false);
export const [stateFromURL, setStateFromURL] = createSignal(false);

// ====================== ARENA VIEWPORT ======================
export const [zoom, setZoom] = createSignal(2.0);
export const [coords, setCoords] = createSignal("");
export const [offsetX, setOffsetX] = createSignal(0);
export const [offsetY, setOffsetY] = createSignal(0);

// ====================== HELPERS ======================
export function setupTempSelectedDolls() {
	setTempSelectedDolls(
		produce((selectedDolls) => {
			console.log("Setting up tempSelectedDolls", selectedDolls.length, state.selectedDolls.length);
			selectedDolls.length = 0;
			for (const doll of state.selectedDolls) {
				selectedDolls.push({
					id: doll.id,
					fortification: doll.fortification,
					keys: [...doll.keys],
					remoldingLvl: doll.remoldingLvl,
					gun: doll.gun,
					borrow: doll.borrow ?? false,
				});
			}
		})
	);
}

export function removeDollFromTempSelect(dollId: string) {
	setTempSelectedDolls(
		produce((selectedDolls) => {
			const index = selectedDolls.findIndex((doll) => doll.id === dollId);
			if (index > -1) {
				selectedDolls.splice(index, 1);
			}
		})
	);
}

export function addDollToTempSelect(dollId: string) {
	setTempSelectedDolls(
		produce((selectedDolls) => {
			selectedDolls.push({
				id: dollId,
				fortification: 0,
				keys: Array(8).fill(""),
				remoldingLvl: 0,
				gun: "",
				borrow: false,
			});
		})
	);
}

export function setDollWeapon(dollId: string, weaponId: string | null) {
	if (!weaponId || !dollId) return;
	setTempSelectedDolls(
		produce((selectedDolls) => {
			for (const doll of selectedDolls) {
				if (doll.id === dollId) {
					doll.gun = weaponId;
				}
			}
		})
	);
}

export function setBuffs(buffIds: string[]) {
	setState(
		produce((s) => {
			s.buffs.length = 0;
			s.buffs.push(...buffIds);
		})
	);
	saveToLocalStorage();
}

export function setDollKeys(dollId: string, keys: string[]) {
	if (!dollId) return;
	setTempSelectedDolls(
		produce((selectedDolls) => {
			for (const doll of selectedDolls) {
				if (doll.id === dollId) {
					doll.keys.length = 0;
					doll.keys.push(...keys);
				}
			}
		})
	);
}

export function changeFortification(dollId: string, fort: number) {
	setTempSelectedDolls(
		produce((tempSelected) => {
			const index = tempSelected.findIndex((d) => d.id === dollId);
			if (index !== -1) {
				tempSelected[index].fortification += fort;
				tempSelected[index].fortification = Math.max(0, tempSelected[index].fortification);
				tempSelected[index].fortification = Math.min(6, tempSelected[index].fortification);
			}
		})
	);
}

export function changeBorrow(dollId: string) {
	setTempSelectedDolls(
		produce((tempSelected) => {
			for (const doll of tempSelected) {
				doll.borrow = false;
				if (doll.id === dollId) {
					doll.borrow = !doll.borrow;
				}
			}
		})
	);
}

export function changeRemoldingLvl(dollId: string, modifier: number) {
	const remoldingLevels = [1, 10, 20, 30, 45, 60];
	setTempSelectedDolls(
		produce((tempSelected) => {
			const index = tempSelected.findIndex((d) => d.id === dollId);
			if (index !== -1) {
				let currentLvl = remoldingLevels.indexOf(tempSelected[index].remoldingLvl);
				currentLvl += modifier;
				currentLvl = Math.max(0, currentLvl);
				currentLvl = Math.min(remoldingLevels.length - 1, currentLvl);
				tempSelected[index].remoldingLvl = remoldingLevels[currentLvl];
			}
		})
	);
}

export function saveDollLoadout(dollId: string) {
	const index = tempSelectedDolls.findIndex((d) => d.id === dollId);
	if (index !== -1) {
		const doll = tempSelectedDolls[index];
		localStorage.setItem(DOLL_LOADOUT_KEY(dollId), JSON.stringify(doll));
	}
}

export function loadDollLoadout(dollId: string) {
	const loadout = localStorageLoad<SelectedDoll>(DOLL_LOADOUT_KEY(dollId));
	setTempSelectedDolls(
		produce((selectedDolls) => {
			for (const doll of selectedDolls) {
				if (doll.id === dollId && loadout) {
					doll.fortification = loadout.fortification;
					doll.keys = [...loadout.keys];
					doll.remoldingLvl = loadout.remoldingLvl;
					doll.gun = loadout.gun;
					doll.borrow = loadout.borrow ?? false;
				}
			}
		})
	);
}

export function dollHasLoadout(dollId: string): boolean {
	return localStorage.getItem(DOLL_LOADOUT_KEY(dollId)) !== null;
}

export function getInfoFromId(id: string): DollData | SummonData | undefined {
	for (const doll of allDolls) {
		if (doll.id === id) return doll;
	}
	for (const summon of allSummons) {
		if (summon.id === id) return summon;
	}
	return undefined;
}

export function getDollFromId(id: string): DollData | undefined {
	for (const doll of allDolls) {
		if (doll.id === id) return doll;
	}
	return undefined;
}

export function getSummonFromId(id: string): SummonData | undefined {
	for (const summon of allSummons) {
		if (summon.id === id) return summon;
	}
	return undefined;
}

export function getKeyFromId(dollId: string, keyId: string, dollInfo?: DollData): FixedKey | DetailedKey | undefined {
	if (!keyId) return undefined;
	const identifier = keyId.charAt(0);
	if (identifier === "k") {
		dollInfo = dollInfo ?? getDollFromId(dollId);
		if (!dollInfo) return undefined;
		return dollInfo.keys.find((k) => k.id === keyId);
	} else if (identifier === "c") {
		return allKeys.common.find((k) => k.id === keyId);
	} else if (identifier === "a") {
		return allKeys.affinity.find((k) => k.id === keyId);
	}
	return undefined;
}

export function getDollFromSummon(summon: SummonData | DollData): DollData {
	if ("dollId" in summon === false) return summon;
	return allDolls.find((d) => d.id === summon.dollId) as DollData;
}

export function isVisible(phase: string): boolean {
	return activePhaseTab() === "All" || phase === activePhaseTab() || (phase === "Omni" && activePhaseTab() !== "Physical");
}

export function visibleDollIndex(doll: DollData) {
	const dolls = allDolls.filter((d) => isVisible(d.phase));
	const index = dolls.findIndex((d) => d.id === doll.id);
	if (index === -1) return allDolls.length;
	return index;
}

export function getDollStartingPosition(dollId: string, instanceId: string | null): number {
	let pos = gridKey(-1, -1);
	if (instanceId) {
		for (const p of state.tabData[0]!.summonPositions) {
			if (p.id === dollId && p.mapId === instanceId) {
				pos = gridKey(p.x, p.y);
			}
		}
	}
	const dollPos = state.tabData[0]!.dollPositions[dollId];
	pos = gridKey(dollPos?.x ?? -1, dollPos?.y ?? -1);
	return pos;
}

export function getSortedUsableSkills(doll: DollData | SummonData) {
	const usable = (doll.skills || []).filter((s) => s.type !== "Passive" || s.name === "Escort");
	const basic = usable.filter((s) => s.type === "Basic Attack");
	const endTurn = usable.filter((s) => s.type === "End Turn");
	const numbered = usable
		.filter((s) => (s.type || "").startsWith("Skill "))
		.sort((a, b) => parseInt((a.type || "").replace("Skill ", "")) - parseInt((b.type || "").replace("Skill ", "")));
	const rest = usable
		.filter((s) => !basic.includes(s) && !numbered.includes(s) && !endTurn.includes(s))
		.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
	return [...basic, ...numbered, ...rest, ...endTurn];
}

export function isPlaced(dollId: string): boolean {
	for (const p of state.tabData[state.currentTab]!.summonPositions) {
		if (p.id === dollId) return true;
	}
	const pos = state.tabData[state.currentTab]!.dollPositions[dollId];
	return !!pos && pos.x > -1;
}

export function getPositionsForDoll(dollId: string): Position[] {
	const positions: Position[] = [];
	for (const p of state.tabData[state.currentTab]!.summonPositions) {
		if (p.id === dollId) positions.push({ x: p.x, y: p.y });
	}
	const pos = state.tabData[state.currentTab]!.dollPositions[dollId];
	if (pos) positions.push(pos);
	return positions;
}

export function getDollPosition(dollId: string, instanceId: string | null): Position | null {
	const positions: Position[] = [];
	for (const p of state.tabData[state.currentTab]!.summonPositions) {
		if (p.id === dollId && p.mapId === instanceId) return { x: p.x, y: p.y };
	}
	const pos = state.tabData[state.currentTab]!.dollPositions[dollId];
	if (pos) return pos;
	return null;
}

export function getFortificationFromId(id: string): number {
	return state.selectedDolls.find((d) => d.id === id)?.fortification ?? 0;
}

export function getSummonIdsFromDollIds(ids: string[]): string[] {
	const res: string[] = [];
	for (const id of ids) {
		const info = getDollFromId(id);
		if (info?.hasSummons) res.push(...info.summons);
	}
	return res;
}

export function getDollNamesAndFortifications() {
	const dolls: string[] = [];
	for (const sd of state.selectedDolls) {
		const doll = getInfoFromId(sd.id) as DollData | undefined;
		if (!doll) continue;
		dolls.push(`${doll.name} (V${getFortificationFromId(sd.id)})`);
	}
	return dolls;
}

export function getSelectedDollAndSummonInfo(excludeIds: string[] = []): (DollData | SummonData)[] {
	const dolls: (DollData | SummonData)[] = [];
	for (const sd of state.selectedDolls) {
		const doll = getDollFromId(sd.id);
		if (!doll) continue;
		if (!excludeIds.includes(sd.id)) dolls.push(doll);
		for (const summonId of doll.summons) {
			if (!excludeIds.includes(summonId)) {
				const summon = getSummonFromId(summonId);
				if (summon) dolls.push(summon);
			}
		}
	}
	return dolls;
}

export function renderAction(dollId: string, action: SkillAction): string {
	const [skillId, targetId] = action;
	const doll = getInfoFromId(dollId);
	if (!doll) return "";
	const skill = doll.skills.find((s) => s.id === skillId);
	if (!skill) return "";
	if (targetId) {
		const target = getInfoFromId(targetId);
		return getSkillDisplay(skill.type) + ">" + (target?.name ?? "?");
	}
	return getSkillDisplay(skill.type);
}

export function displaySmallKeys(dollId: string, keys: string[]) {
	const blankCommonKey = { type: "Common Key", rarity: "None" };
	const blankFixedKey = { type: "Fixed Key", rarity: "None" };
	const keyMapping = ["Fixed Key", "Fixed Key", "Fixed Key", "Expansion Key", "Affinity Key", "Common Key", "Common Key", "Common Key"];
	const doll = getInfoFromId(dollId) as DollData | null;
	if (!doll) return [];
	const result = [];
	const sortedKeys = sortDisplayEquippedKeys(dollId, keys);
	for (const [index, keyType] of keyMapping.entries()) {
		const keyInfo = sortedKeys[index];
		if (keyType === "Expansion Key") result.push("=");
		if (doll.hasExpansionKey === false && keyType === "Expansion Key") continue;
		if (keyInfo === null) {
			if (keyType === "Fixed Key" || keyType === "Expansion Key") result.push(blankFixedKey);
			else if (keyType === "Common Key" || keyType === "Affinity Key") result.push(blankCommonKey);
		} else {
			result.push(keyInfo);
		}
		if (keyType === "Affinity Key") result.push("=");
	}
	return result;
}

export function sortEquippedKeys(dollId: string, keys: string[]): string[] {
	const keyMapping = ["Fixed Key", "Fixed Key", "Fixed Key", "Expansion Key", "Affinity Key", "Common Key", "Common Key", "Common Key"];
	const result = Array(keyMapping.length).fill("");
	const doll = getInfoFromId(dollId) as DollData | null;
	if (!doll) return result;
	let fixedKeyIndex = keyMapping.indexOf("Fixed Key");
	let commonKeyIndex = keyMapping.indexOf("Common Key");
	const expansionKeyIndex = keyMapping.indexOf("Expansion Key");
	const affinityKeyIndex = keyMapping.indexOf("Affinity Key");
	for (const [index, keyType] of keyMapping.entries()) {
		const keyId = keys[index] ?? "";
		if (keyId === "") {
			continue;
		}
		let keyInfo = getKeyFromId(dollId, keyId, doll);
		if (keyInfo && keyInfo.type === "Fixed Key") {
			result[fixedKeyIndex] = keyId;
			fixedKeyIndex += 1;
			continue;
		} else if (keyInfo && keyInfo.type === "Common Key") {
			result[commonKeyIndex] = keyId;
			commonKeyIndex += 1;
			continue;
		} else if (keyInfo && keyInfo.type === "Affinity Key") {
			result[affinityKeyIndex] = keyId;
			continue;
		} else if (keyInfo && keyInfo.type === "Expansion Key") {
			result[expansionKeyIndex] = keyId;
			continue;
		} else {
			console.error("Unable to find key", keyId, doll);
		}
	}
	return result;
}

export function getPreSortedKeyInfo(dollId: string, keys: string[]): (FixedKey | DetailedKey | null)[] {
	const keyMapping = ["Fixed Key", "Fixed Key", "Fixed Key", "Expansion Key", "Affinity Key", "Common Key", "Common Key", "Common Key"];
	const result = Array(keyMapping.length).fill(null);
	const doll = getInfoFromId(dollId) as DollData | null;
	if (!doll) return result;
	for (const [index, keyId] of keys.entries()) {
		if (keyId === "") {
			continue;
		}
		let keyInfo = getKeyFromId(dollId, keyId, doll);
		if (keyInfo) {
			result[index] = keyInfo;
		} else {
			console.error("Unable to find key", keyId, doll);
		}
	}
	return result;
}

export function sortDisplayEquippedKeys(dollId: string, keys: string[]): (FixedKey | DetailedKey | null)[] {
	const keyMapping = ["Fixed Key", "Fixed Key", "Fixed Key", "Expansion Key", "Affinity Key", "Common Key", "Common Key", "Common Key"];
	const result = Array(keyMapping.length).fill(null);
	const doll = getInfoFromId(dollId) as DollData | null;
	if (!doll) return result;
	let fixedKeyIndex = keyMapping.indexOf("Fixed Key");
	let commonKeyIndex = keyMapping.indexOf("Common Key");
	const expansionKeyIndex = keyMapping.indexOf("Expansion Key");
	const affinityKeyIndex = keyMapping.indexOf("Affinity Key");
	for (const [index, keyType] of keyMapping.entries()) {
		const keyId = keys[index] ?? "";
		if (keyId === "") {
			continue;
		}
		let keyInfo = getKeyFromId(dollId, keyId, doll);
		if (keyInfo && keyInfo.type === "Fixed Key") {
			result[fixedKeyIndex] = keyInfo;
			fixedKeyIndex += 1;
			continue;
		} else if (keyInfo && keyInfo.type === "Common Key") {
			result[commonKeyIndex] = keyInfo;
			commonKeyIndex += 1;
			continue;
		} else if (keyInfo && keyInfo.type === "Affinity Key") {
			result[affinityKeyIndex] = keyInfo;
			continue;
		} else if (keyInfo && keyInfo.type === "Expansion Key") {
			result[expansionKeyIndex] = keyInfo;
			continue;
		} else {
			console.error("Unable to find key", keyId, doll);
		}
	}
	return result;
}

// ====================== DEFAULT ACTION ORDER ======================
export function defaultActionOrder(tabIndex: number) {
	if (tabIndex < 0 || tabIndex > 7) return;
	const order = new Set(state.tabData[tabIndex].actionOrder);
	const unique = new Set();
	setState(
		produce((s) => {
			const turn = s.tabData[tabIndex]!;
			for (const doll of s.selectedDolls) {
				order.add(doll.id);
				unique.add(doll.id);
				const dollInfo = getDollFromId(doll.id);
				if (dollInfo?.hasSummons) {
					for (const summonId of dollInfo.summons) {
						order.add(summonId);
						unique.add(summonId);
					}
				}
			}
			for (const dollId of order) {
				if (unique.has(dollId) === false) {
					order.delete(dollId);
				}
			}
			s.tabData[tabIndex].actionOrder = Array.from(order);
		})
	);
}

// ====================== CHANGE SELECTED DOLLS ======================
function changeSelectedDolls(newDolls: SelectedDoll[]) {
	const oldIds = state.selectedDolls.map((d) => d.id);
	oldIds.push(...getSummonIdsFromDollIds(oldIds));
	const newIds = newDolls.map((d) => d.id);
	newIds.push(...getSummonIdsFromDollIds(newIds));
	const removed = oldIds.filter((d) => !newIds.includes(d));
	const added = newIds.filter((d) => !oldIds.includes(d));

	setState(
		produce((s) => {
			s.selectedDolls.length = 0;
			s.selectedDolls.push(...newDolls);
			for (let tabIndex = 0; tabIndex < 8; tabIndex++) {
				const tab = s.tabData[tabIndex]!;
				for (const dollId of removed) {
					delete tab.dollPositions[dollId];
					delete tab.actions[dollId];
					const orderIndex = tab.actionOrder.indexOf(dollId);
					if (orderIndex !== -1) tab.actionOrder.splice(orderIndex, 1);
					tab.summonPositions = tab.summonPositions.filter((p) => p.id !== dollId);
				}
				for (const dollId of added) {
					tab.dollPositions[dollId] = { x: -1, y: -1 };
					tab.actions[dollId] = [];
					if (!tab.actionOrder.includes(dollId)) tab.actionOrder.push(dollId);
				}
			}
			if (added.length || removed.length) {
				// reset score and description if present when dolls change, as that's likely a new team
				s.score = 0;
				s.description = "";
			}
			console.log("Changing selected dolls", added, removed, s.selectedDolls.length);
		})
	);
}

export async function updateSelectedDolls() {
	changeSelectedDolls([...tempSelectedDolls]);
	await preloadCanvasImages();
	for (let i = 0; i < 8; i++) defaultActionOrder(i);
	saveToLocalStorage();
}

// ====================== PERSISTENCE ======================
export function saveToLocalStorage() {
	console.log("Saving to localStorage");
	setStateFromURL(false);
	window.history.replaceState({}, document.title, window.location.origin + window.location.pathname);
	localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: SAVE_VERSION, ...state }));
}

export function resetToDefaultState() {
	console.log("Saving to localStorage");
	setStateFromURL(false);
	window.history.replaceState({}, document.title, window.location.origin + window.location.pathname);
	localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: SAVE_VERSION, ...defaultState }));
}

export function saveSkillDisplay() {
	localStorage.setItem(SKILL_DISPLAY_KEY, JSON.stringify({ override: overrideSkillNotations(), skillDisplay: state.skillDisplay }));
}

export function compareStateHash(localState: AppState) {
	const storedState = localStorageLoad<AppState & { version: number }>(STORAGE_KEY);
	if (!storedState) return false;
	const clone: Exclude<AppState, "version"> = structuredClone(unwrap(localState));
	const oldState = {
		selectedDolls: storedState.selectedDolls,
		map: storedState.map,
		buffs: storedState.buffs ?? [],
		tabData: storedState.tabData,
	};
	const newState = {
		selectedDolls: clone.selectedDolls,
		map: clone.map,
		buffs: clone.buffs ?? [],
		tabData: clone.tabData,
	};
	return JSON.stringify(oldState) === JSON.stringify(newState);
}

export function loadState(newData: AppState & { version: number }) {
	const incomingState = version7To8Upgrade(newData);
	setState(
		produce((s) => {
			s.selectedDolls = incomingState.selectedDolls;
			s.currentTab = incomingState.currentTab;
			s.map = incomingState.map;
			s.score = incomingState.score ?? 0;
			s.description = incomingState.description ?? "";
			s.buffs = incomingState.buffs ?? [];
			if (incomingState.skillDisplay) {
				s.skillDisplay = incomingState.skillDisplay;
			}
			for (let tabIndex = 0; tabIndex < 8; tabIndex++) {
				const src = incomingState.tabData[tabIndex]!;
				const tab = s.tabData[tabIndex]!;
				tab.summonPositions.length = 0;
				tab.actionOrder.length = 0;
				tab.dollPositions = {};
				tab.actions = {};
				for (const doll of s.selectedDolls) {
					tab.dollPositions[doll.id] = {
						x: src.dollPositions[doll.id]?.x ?? -1,
						y: src.dollPositions[doll.id]?.y ?? -1,
					};
				}
				tab.summonPositions.push(...(src.summonPositions || []));
				tab.actionOrder.push(...(src.actionOrder || []));
				for (const doll of s.selectedDolls) {
					tab.actions[doll.id] = [...(src.actions[doll.id] ?? [])];
					const dollInfo = getDollFromId(doll.id);
					if (dollInfo?.hasSummons) {
						for (const summonId of dollInfo.summons) {
							tab.actions[summonId] = [...(src.actions[summonId] ?? [])];
						}
					}
				}
			}
		})
	);
	for (let i = 0; i < 8; i++) defaultActionOrder(i);
	setEditingMap(state.map);
}

export function version7To8Upgrade(data: AppState & { version: number }) {
	if (data.version !== V7_SAVE_VERSION) return data;
	data.version = 8;
	if (typeof data.actionType === "number") {
		if (data.actionType === 0) {
			data.actionType = "0000000";
		}
		if (data.actionType === 1) {
			data.actionType = "1111111";
		}
		if (data.actionType === 2) {
			data.actionType = "2222222";
		}
	} else if (typeof data.actionType === "string") {
		if (data.actionType.length !== 7) {
			data.actionType = "0000000";
		}
	}
	if (data.actionType && typeof data.actionType === "string" && data.actionType.length === 7) {
		data.skillDisplay.length = 0;
		for (const character of Array.from(data.actionType)) {
			data.skillDisplay.push(parseInt(character));
		}
	}
	delete data.actionType;
	data.map = "Tusk Beasteel";
	data.score = 0;
	data.description = "";
	data.buffs = data.buffs ?? [];
	for (const doll of data.selectedDolls) {
		if (!doll.keys || doll.keys.length !== 8) {
			doll.keys = Array(8).fill("");
		}
		doll.remoldingLvl = doll.remoldingLvl ?? 1;
		doll.fortification = doll.fortification ?? 0;
		doll.gun = doll.gun ?? "";
		doll.borrow = doll.borrow ?? false;
	}
	return data;
}

function localStorageLoad<T>(key: string): T | null {
	try {
		const item = localStorage.getItem(key);
		if (!item) return null;
		return JSON.parse(item) as T;
	} catch (e) {
		console.error("Error loading from localStorage", e);
		return null;
	}
}

export function migrate() {
	if (!localStorage.getItem(V7_STORAGE_KEY)) return;
	if (localStorage.getItem(STORAGE_KEY)) return;
	console.log("Migrating data from version 7 to version 8");
	const v7Data = localStorageLoad<AppState & { version: number }>(V7_STORAGE_KEY);
	const v7Skills = localStorageLoad<SkillDisplay>(V7_SKILL_DISPLAY_KEY);
	const v7Map = localStorageLoad<MapGrid>(V7_EDITOR_MAP_KEY);
	if (v7Data) {
		const upgraded = version7To8Upgrade(v7Data);
		localStorage.setItem(STORAGE_KEY, JSON.stringify(upgraded));
	}
	if (v7Skills) {
		localStorage.setItem(SKILL_DISPLAY_KEY, JSON.stringify(v7Skills));
	}
	if (v7Map) {
		localStorage.setItem(CUSTOM_MAP_KEY, JSON.stringify(v7Map));
	}
}

export async function importState(
	processFn: (data: string) => Promise<(AppState & { version: number }) | null>,
	data: string,
	fallback = false
) {
	const oldState = localStorageLoad<AppState & { version: number }>(STORAGE_KEY);
	try {
		const appState = await processFn(data);
		if (!appState && fallback && oldState && oldState.version === SAVE_VERSION) {
			alert("Failed to import state, loading old state");
			console.error("Please pass this text to ArkahnX:\n" + data);
			loadState(oldState);
			return;
		}
		if (!appState) {
			alert("Failed to import state and no old state found");
			console.error("Please pass this text to ArkahnX:\n" + data);
			return;
		}
		const migrated = version7To8Upgrade(appState);
		if (migrated.version !== SAVE_VERSION) {
			alert("Unsupported version");
			return;
		}
		loadState(migrated);
		for (let i = 0; i < 8; i++) defaultActionOrder(i);
		await preloadCanvasImages();
		const SkillConfig = localStorageLoad<SkillDisplay>(SKILL_DISPLAY_KEY);
		if (SkillConfig) {
			setOverrideSkillNotations(SkillConfig.override);
			if (SkillConfig.override === true) {
				overrideSkillDisplay(SkillConfig.skillDisplay);
			}
		}

		loadMap(state.map);
		setupTempSelectedDolls();
		console.log("finished loading state");
		if (stateFromURL() === false) {
			saveToLocalStorage();
		}
	} catch (e) {
		alert("Error importing state");
		console.error("Error importing state", e);
		if (fallback && oldState && oldState.version === SAVE_VERSION) {
			loadState(oldState);
			for (let i = 0; i < 8; i++) defaultActionOrder(i);
			await preloadCanvasImages();
			const SkillConfig = localStorageLoad<SkillDisplay>(SKILL_DISPLAY_KEY);
			if (SkillConfig) {
				setOverrideSkillNotations(SkillConfig.override);
				if (SkillConfig.override === true) {
					overrideSkillDisplay(SkillConfig.skillDisplay);
				}
			}

			loadMap(state.map);
			setupTempSelectedDolls();
			console.log("finished loading backup state");
			return;
		}
	}
}

export function loadFromLocalStorage(data: string): Promise<(AppState & { version: number }) | null> {
	return new Promise((resolve) => {
		if (localStorage.getItem(STORAGE_KEY) === null) {
			resolve({ version: SAVE_VERSION, ...defaultState });
		} else {
			resolve(localStorageLoad<AppState & { version: number }>(STORAGE_KEY));
		}
	});
}

export async function loadFromString(data: string): Promise<(AppState & { version: number }) | null> {
	const decompressed = await decompress(data.trim());
	return JSON.parse(decompressed) as AppState & { version: number };
}

export async function loadFromWorker(stateId: string): Promise<(AppState & { version: number }) | null> {
	const cachedState = localStorage.getItem(stateId);
	if (cachedState !== null) {
		const decompressed = await decompress(cachedState);
		return JSON.parse(decompressed) as AppState & { version: number };
	}
	const res = await fetch(`https://gunsmoke.arkahnx.technology/state?stateId=${stateId}`);

	const data = (await res.json()) as ApiResponse<StateEntry>;
	if (data.error) {
		alert(data.error);
	}
	if (data.result) {
		const decompressed = await decompress(data.result.state);
		const savedStates = localStorageLoad<string[]>(SAVED_STATES_KEY);
		if (!savedStates) {
			localStorage.setItem(SAVED_STATES_KEY, JSON.stringify([stateId]));
		} else {
			savedStates.push(stateId);
			if (savedStates.length > 10) {
				const removedState = savedStates.shift() as string;
				localStorage.removeItem(removedState);
			}
			localStorage.setItem(SAVED_STATES_KEY, JSON.stringify(savedStates));
		}
		localStorage.setItem(stateId, data.result.state);
		return JSON.parse(decompressed) as AppState & { version: number };
	}
	return null;
}

export function setSkillDisplay(skillType: string, notationStyle: string) {
	const index = notations[skillType].indexOf(notationStyle);
	if (state.skillDisplay[skillOrder.indexOf(skillType)] === index) return;
	console.log("Setting skill display", skillType, notationStyle, index, skillOrder.indexOf(skillType));
	setState(
		produce((s) => {
			s.skillDisplay[skillOrder.indexOf(skillType)] = index;
		})
	);
}

export function getSkillDisplay(skillType: string): string {
	return notations[skillType][state.skillDisplay[skillOrder.indexOf(skillType)] ?? 0];
}

export function overrideSkillDisplay(values: number[]) {
	setState(
		produce((s) => {
			s.skillDisplay.length = 0;
			s.skillDisplay.push(...values);
		})
	);
}

export function sortBuffs(buffId1: string | BuffData, buffId2: string | BuffData) {
	const buff1 = typeof buffId1 === "string" ? allBuffs.find((b) => buffId1 === b.id) : buffId1;
	const buff2 = typeof buffId2 === "string" ? allBuffs.find((b) => buffId2 === b.id) : buffId2;
	if (!buff1 || !buff2) return 0;
	return (
		Number(buff2.season === CURRENT_SEASON) - Number(buff1.season === CURRENT_SEASON) ||
		buff2.season - buff1.season ||
		+buff2.core - +buff1.core ||
		buff1.days?.[CURRENT_SEASON]?.[0] - buff2.days?.[CURRENT_SEASON]?.[0] ||
		buff1.name.localeCompare(buff2.name)
	);
}

// ====================== COMPRESSION ======================
export async function compress(data: AppState): Promise<string> {
	const clone = structuredClone(unwrap(data));
	const exportState: Omit<AppState & { version: number }, "skillDisplay"> = {
		version: SAVE_VERSION,
		selectedDolls: clone.selectedDolls,
		currentTab: 8,
		score: clone.score,
		description: clone.description,
		map: clone.map,
		buffs: (clone.buffs ?? []).sort(sortBuffs),
		tabData: clone.tabData,
	};
	for (const doll of exportState.selectedDolls) {
		doll.keys.sort();
	}
	const byteArray = new TextEncoder().encode(JSON.stringify(exportState));
	const cs = new CompressionStream("deflate");
	const writer = cs.writable.getWriter();
	writer.write(byteArray);
	writer.close();
	const buf = await new Response(cs.readable).arrayBuffer();
	return btoa(String.fromCharCode(...new Uint8Array(buf)))
		.replace(/\+/g, "-")
		.replace(/\//g, "_")
		.replace(/=+$/, "");
}

export async function decompress(b64: string): Promise<string> {
	const bytes = Uint8Array.from(atob(b64.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
	const cs = new DecompressionStream("deflate");
	const writer = cs.writable.getWriter();
	writer.write(bytes);
	writer.close();
	const buf = await new Response(cs.readable).arrayBuffer();
	return new TextDecoder().decode(buf);
}

// ====================== SUMMON/DOLL PLACEMENT ======================
export function placeDoll(id: string, col: number, row: number) {
	setState(
		produce((s) => {
			s.tabData[s.currentTab]!.dollPositions[id] = { x: col, y: row };
		})
	);
	saveToLocalStorage();
}

export function placeSummon(summonId: string, mapId: string, col: number, row: number) {
	setState(
		produce((s) => {
			const positions = s.tabData[s.currentTab]!.summonPositions;
			const existing = positions.find((p) => p.mapId === mapId && p.id === summonId);
			if (existing) {
				existing.x = col;
				existing.y = row;
			} else {
				for (const p of positions) {
					if (p.x === col && p.y === row) return;
				}
				positions.push({ id: summonId, mapId, x: col, y: row });
			}
		})
	);
	saveToLocalStorage();
}

export function swapPositions(
	id: string,
	instanceId: string | null,
	col: number,
	row: number,
	swapDoll: Omit<DragState, "screenX" | "screenY" | "isActive" | "status"> | null
) {
	if (!swapDoll) return;
	setState(
		produce((s) => {
			const oldPosition = getDollPosition(id, instanceId);
			// place new doll
			if (!instanceId) {
				s.tabData[s.currentTab]!.dollPositions[id] = { x: col, y: row };
			} else {
				const positions = s.tabData[s.currentTab]!.summonPositions;
				const existing = positions.find((p) => p.mapId === instanceId && p.id === id);
				if (existing) {
					existing.x = col;
					existing.y = row;
				} else {
					positions.push({ id: id, mapId: instanceId, x: col, y: row });
				}
			}
			if (oldPosition) {
				// move old doll
				if (!swapDoll.instanceId) {
					s.tabData[s.currentTab]!.dollPositions[swapDoll.id] = { x: oldPosition.x, y: oldPosition.y };
				} else {
					const positions = s.tabData[s.currentTab]!.summonPositions;
					const existing = positions.find((p) => p.mapId === swapDoll.instanceId && p.id === swapDoll.id);
					if (existing) {
						existing.x = oldPosition.x;
						existing.y = oldPosition.y;
					}
				}
			} else {
				// if the doll we are trying to place did not have a prior position, remove the swap doll
				if (!swapDoll.instanceId) {
					s.tabData[s.currentTab]!.dollPositions[swapDoll.id] = { x: -1, y: -1 };
				} else {
					const positions = s.tabData[s.currentTab]!.summonPositions;
					const existing = positions.find((p) => p.mapId === swapDoll.instanceId && p.id === swapDoll.id);
					if (existing) {
						positions.splice(positions.indexOf(existing), 1);
					}
				}
			}
		})
	);
	saveToLocalStorage();
}

export function removeDollOrSummon(id?: string, instanceId?: string | null) {
	if (!id) return;
	if (!instanceId) {
		setState(
			produce((s) => {
				s.tabData[s.currentTab]!.dollPositions[id] = { x: -1, y: -1 };
			})
		);
		saveToLocalStorage();
		return;
	}
	setState(
		produce((s) => {
			const positions = s.tabData[s.currentTab]!.summonPositions;
			const existing = positions.find((p) => p.mapId === instanceId && p.id === id);
			if (existing) {
				positions.splice(positions.indexOf(existing), 1);
			}
		})
	);
	saveToLocalStorage();
}

// ====================== IMAGE PRELOADING ======================
export function attachImageToDoll(dollInfo: DollData | SummonData) {
	return new Promise<void>((resolve) => {
		if (!dollInfo.preloadedImage || !dollInfo.preloadedImage.complete) {
			const img = new Image();
			img.src = dollInfo.avatar;
			img.onload = () => resolve();
			img.onerror = () => {
				(dollInfo as any).preloadedImage = null;
			};
			dollInfo.preloadedImage = img;
		} else resolve();
	});
}

export function preloadCanvasImages() {
	return new Promise<void>((resolve) => {
		const entries = [];
		for (const doll of getSelectedDollAndSummonInfo()) {
			entries.push(attachImageToDoll(doll));
		}
		Promise.all(entries).then(() => resolve());
	});
}

// ====================== LOAD DOLLS AND SUMMONS ======================
export async function loadCombinedJson() {
	try {
		const res = await Promise.all([
			fetch("combined.json"),
			fetch("keys.json"),
			fetch("weapons.json"),
			fetch("buffs.json"),
			fetch("effects.json"),
		]);
		const combinedJson: RawDollEntry[] = await res[0].json();
		const keysJson: RawKeyData = await res[1].json();
		const weaponsJson: WeaponData[] = await res[2].json();
		const buffsJson: BuffData[] = await res[3].json();
		const effectsJson: Effect[] = await res[4].json();
		allWeapons.push(...weaponsJson);
		allBuffs.push(...buffsJson);
		allEffects.push(...effectsJson);
		for (const weapon of allWeapons) {
			if (weapon.imprintId === null && weapon.rarity === "Elite") {
				defaultWeapons[weapon.type] = weapon;
			}
		}
		for (const buff of allBuffs) {
			buff.core = buff.core ?? false;
		}

		for (const entry of combinedJson) {
			const hasExpansionKey = (entry.keys ?? []).findIndex((key) => key.type === "Expansion Key") > -1;
			const doll: DollData = {
				id: entry.id,
				name: entry.name,
				phase: entry.phase,
				avatar: entry.avatar,
				remolding: entry.remolding,
				rarity: entry.rarity,
				gunType: entry.gunType,
				hasSummons: false,
				hasExpansionKey: hasExpansionKey,
				skills: entry.skills ? [...entry.skills, endTurnSkill] : [endTurnSkill],
				keys: entry.keys ? entry.keys : [],
				summons: [],
			};
			if (entry.summons) {
				for (const summon of entry.summons) {
					doll.hasSummons = true;
					doll.summons.push(summon.id);
					allSummons.push({
						id: summon.id,
						dollId: entry.id,
						name: summon.name,
						avatar: summon.localImagePath,
						skills: summon.skills ? [...summon.skills, endTurnSkill] : [endTurnSkill],
					});
				}
			}
			allDolls.push(doll);
		}
		for (const key of keysJson.affinity) {
			const dollInfo = allDolls.find((d) => d.id === key.dollId);
			allKeys.affinity.push({
				dollName: dollInfo ? dollInfo.name : "",
				dollAvatar: dollInfo ? dollInfo.avatar : "",
				...key,
			});
		}
		for (const key of keysJson.common) {
			const dollInfo = allDolls.find((d) => d.id === key.dollId);
			allKeys.common.push({ dollName: dollInfo ? dollInfo.name : "", dollAvatar: dollInfo ? dollInfo.avatar : "", ...key });
		}
	} catch (e) {
		console.error(e);
	}
}

// ====================== CSS HELPERS ======================

export const interactiveStyles = (selected: boolean | null | undefined = false) =>
	"cursor-pointer outline-3 transition transition-discrete duration-175 hover:scale-107 hover:outline-white " +
	(selected === true ? "outline-[#F26C1C]" : selected === null ? "outline-transparent" : "outline-transparent");

export const parseEffects = (description: string, skillNames: Map<string, string>) => {
	return description.replace(/\{(e[0-9]+)\}/gi, (match, effectId) => {
		const effect = allEffects.find((s) => s.id === effectId);
		if (effect) {
			return `<b><u>${effect.name}</u></b>`;
		}
		return `<b><u>Unknown Effect ${effectId}</u></b>`;
	}).replace(/\{(s[0-9]+)\}/gi, (match, skillId) => {
		const skill = skillNames.get(skillId);
		if (skill) {
			return `<b><u>${skill}</u></b>`;
		}
		return `<b><u>Unknown Effect ${skillId}</u></b>`;
	});
};

export function runAfterFramePaint(callback: () => void) {
	// Queue a "before Render Steps" callback via requestAnimationFrame.
	requestAnimationFrame(() => {
		const messageChannel = new MessageChannel();

		// Setup the callback to run in a Task
		messageChannel.port1.onmessage = callback;

		// Queue the Task on the Task Queue
		messageChannel.port2.postMessage(undefined);
	});
}
