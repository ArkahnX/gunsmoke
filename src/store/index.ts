import { createStore, produce } from "solid-js/store";
import { createSignal } from "solid-js";
import type {
	AppState,
	DollData,
	SummonData,
	MapCell,
	EditorTool,
	BoundaryDir,
	SelectedDoll,
	SkillAction,
	Position,
	SummonPosition,
	TabData,
} from "../types";
import { MAP_SIZE, SAVE_VERSION, STORAGE_KEY, EDITOR_MAP_KEY, CANVAS_SIZE, TILE_SIZE } from "../types/constants";

// ====================== MAP GRID ======================
export const mapGrid: Record<string, MapCell> = {};

export function gridKey(c: number, r: number): string {
	return `${c},${r}`;
}
export function cellX(c: number): number {
	return c * TILE_SIZE;
}
export function cellY(r: number): number {
	return r * TILE_SIZE;
}
export function inMapBounds(c: number, r: number): boolean {
	return c >= 0 && c < MAP_SIZE && r >= 0 && r < MAP_SIZE;
}
export function getCell(c: number, r: number): MapCell {
	const k = gridKey(c, r);
	if (!mapGrid[k]) mapGrid[k] = { cover: null, bossOrigin: null, spawn: false, bndH: false, bndV: false };
	return mapGrid[k]!;
}
export function hasCover(c: number, r: number): boolean {
	if (!inMapBounds(c, r)) return false;
	const cell = mapGrid[gridKey(c, r)];
	return !!cell && cell.cover !== null;
}

// ====================== DOLL / SUMMON LISTS ======================
export { SAVE_VERSION } from "../types/constants";
export const [allDolls, setAllDolls] = createSignal<DollData[]>([]);
export const [allSummons, setAllSummons] = createSignal<SummonData[]>([]);

// ====================== EDITOR STATE ======================
export const [editorTool, setEditorTool] = createSignal<EditorTool>("spawn");
export const [boundaryDir, setBoundaryDir] = createSignal<BoundaryDir>("h");
export const [editorStatus, setEditorStatus] = createSignal("Left-click / drag to place · Right-click to erase");
export const [editorCoords, setEditorCoords] = createSignal("");
export const [editorIoMode, setEditorIoMode] = createSignal<"export" | "import">("export");
export const [editorIoText, setEditorIoText] = createSignal("");
export const [showEditorIo, setShowEditorIo] = createSignal(false);

// ====================== APP STATE ======================
function makeDefaultTabData(): TabData {
	return { actionOrder: [], actions: {}, dollPositions: {}, summonPositions: [] };
}

export const [state, setState] = createStore<AppState>({
	selectedDolls: [],
	currentTab: 0,
	actionType: 0,
	tabData: Array.from({ length: 8 }, () => makeDefaultTabData()),
});

// ====================== MODAL STATE ======================
export const [showDollModal, setShowDollModal] = createSignal(false);
export const [showFortificationModal, setShowFortificationModal] = createSignal(false);
export const [showImportModal, setShowImportModal] = createSignal(false);
export const [showTargetModal, setShowTargetModal] = createSignal(false);
export const [targetSkillInfo, setTargetSkillInfo] = createSignal("");
export const [targetDollId, setTargetDollId] = createSignal<string | null>(null);
export const [targetSkillId, setTargetSkillId] = createSignal<number | null>(null);
export const [activePhaseTab, setActivePhaseTab] = createSignal<string>("All");
export const [tempSelected, setTempSelected] = createSignal<string[]>([]);
export const [dollFortification, setDollFortification] = createSignal<Record<string, number>>({});

// ====================== ARENA VIEWPORT ======================
export const [zoom, setZoom] = createSignal(2.0);
export const [offsetX, setOffsetX] = createSignal(0);
export const [offsetY, setOffsetY] = createSignal(0);

// ====================== HELPERS ======================
export function getDollInfoFromId(id: string): DollData | SummonData | undefined {
	if (id.startsWith("d")) return allDolls().find((d) => d.id === id);
	if (id.startsWith("s")) return allSummons().find((d) => d.id === id);
	return undefined;
}

export function getDollFromSummon(summon: SummonData | DollData): DollData {
	if ("dollId" in summon === false) return summon;
	return allDolls().find((d) => d.id === summon.dollId) as DollData;
}

export function getSortedUsableSkills(doll: DollData | SummonData) {
	const usable = (doll.skills || []).filter((s) => s.type !== "Passive" || s.name === "Escort");
	const basic = usable.filter((s) => s.type === "Basic Attack");
	const numbered = usable
		.filter((s) => (s.type || "").startsWith("Skill "))
		.sort((a, b) => parseInt((a.type || "").replace("Skill ", "")) - parseInt((b.type || "").replace("Skill ", "")));
	const rest = usable
		.filter((s) => !basic.includes(s) && !numbered.includes(s))
		.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
	return [...basic, ...numbered, ...rest];
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

export function getFortificationFromId(id: string): number {
	return state.selectedDolls.find((d) => d.id === id)?.fortification ?? 0;
}

export function getSummonIdsFromDollIds(ids: string[]): string[] {
	const res: string[] = [];
	for (const id of ids) {
		const doll = allDolls().find((d) => d.id === id);
		if (doll?.hasSummons) res.push(...doll.summons);
	}
	return res;
}

export function getSelectedDollAndSummonInfo(excludeIds: string[] = []): (DollData | SummonData)[] {
	const dolls: (DollData | SummonData)[] = [];
	for (const sd of state.selectedDolls) {
		const doll = getDollInfoFromId(sd.id) as DollData | undefined;
		if (!doll) continue;
		if (!excludeIds.includes(sd.id)) dolls.push(doll);
		for (const summonId of doll.summons) {
			if (!excludeIds.includes(summonId)) {
				const s = allSummons().find((s) => s.id === summonId);
				if (s) dolls.push(s);
			}
		}
	}
	return dolls;
}

export function renderAction(dollId: string, action: SkillAction): string {
	const [skillId, targetId] = action;
	const doll = getDollInfoFromId(dollId);
	if (!doll) return "";
	const sorted = getSortedUsableSkills(doll);
	const skillName = ["BA", "S1", "S2", "ULT", "S3", "S4", "S5", "S6"];
	const skillNum = sorted.findIndex((s) => s.id === skillId) + 1;
	if (targetId) {
		const target = getDollInfoFromId(targetId);
		if (state.actionType === 0) return `S${skillNum}>${target?.name ?? "?"}`;
		if (state.actionType === 1) return `${skillNum}>${target?.name ?? "?"}`;
		if (state.actionType === 2) return `${skillName[skillNum - 1]}>${target?.name ?? "?"}`;
	}
	if (state.actionType === 0) return `S${skillNum}`;
	if (state.actionType === 1) return `${skillNum}`;
	if (state.actionType === 2) return `${skillName[skillNum - 1]}`;
	return `S${skillNum}`;
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
				const dollInfo = allDolls().find((d) => d.id === doll.id);
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
export function changeSelectedDolls(newDolls: SelectedDoll[]) {
	const oldIds = state.selectedDolls.map((d) => d.id);
	oldIds.push(...getSummonIdsFromDollIds(oldIds));
	const newIds = newDolls.map((d) => d.id);
	newIds.push(...getSummonIdsFromDollIds(newIds));
	const removed = oldIds.filter((d) => !newIds.includes(d));
	const added = newIds.filter((d) => !oldIds.includes(d));

	setState(
		produce((s) => {
			s.selectedDolls = newDolls;
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
		})
	);
}

// ====================== PERSISTENCE ======================
export function saveToLocalStorage() {
	localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: SAVE_VERSION, ...state }));
}

export function loadState(newData: AppState & { version: number }) {
	setState(
		produce((s) => {
			s.selectedDolls = newData.selectedDolls;
			s.currentTab = newData.currentTab;
			s.actionType = newData.actionType || 0;
			for (let tabIndex = 0; tabIndex < 8; tabIndex++) {
				const src = newData.tabData[tabIndex]!;
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
					const dollInfo = allDolls().find((d) => d.id === doll.id);
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
}

export function loadFromLocalStorage(): boolean {
	const saved = localStorage.getItem(STORAGE_KEY);
	if (!saved) return false;
	try {
		const data = JSON.parse(saved);
		if (data.version !== SAVE_VERSION) return false;
		loadState(data);
		return true;
	} catch {
		return false;
	}
}

export function updateSkillDisplay(actionType: number) {
	setState(
		produce((s) => {
			s.actionType = actionType;
		})
	);
	saveToLocalStorage();
}

// ====================== COMPRESSION ======================
export async function compress(str: string): Promise<string> {
	const byteArray = new TextEncoder().encode(str);
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
