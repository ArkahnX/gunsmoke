import { produce, reconcile, unwrap } from "solid-js/store";
import { ApiResponse, LocalState, Position, StateEntry } from "../types";
import {
	SAVED_STATES_KEY,
	V8_STORAGE_KEY,
	V7_STORAGE_KEY,
	V9_LOCAL_STATE,
	V9_SAVE_VERSION,
	FAILED_STATE_BACKUP_KEY,
	V9_STORAGE_KEY,
} from "../types/constants";
import {
	defaultState,
	localState,
	makeDefaultTabData,
	nextSummonInstanceId,
	notations,
	setLocalState,
	setState,
	state,
} from "./appState";
import { pushImportError, setStateFromURL, stateFromURL } from "./uiState";
import { setupTempSelectedDolls } from "./dollSelection";
import { checkMap, isBuiltInMap, loadMap, toPlainMap } from "../canvas/editorMap";
import { getSelectedDoll, sortBuffs, summonBaseIdOf } from "./gameData";
import { preloadCanvasImages } from "./images";
import { DollId, SummonId } from "../../gfl2-data/types";
import { SaveImportError, upgradeSave } from "./migration";
import { uniqueMessages, validateSave } from "./validation";
import { currentChain, log, logScope } from "../log";
import { CurrentSave, SaveV7, SaveV8, SaveV9, SaveV9Action, SaveV9TabData } from "../types/saves";
import { localStorageLoad, saveToLocalStorage } from "./storage";

export function resetToDefaultState() {
	setStateFromURL(false);
	window.history.replaceState({}, document.title, window.location.origin + window.location.pathname);
	localStorage.setItem(V9_STORAGE_KEY, JSON.stringify(defaultState));
}

export function saveLocalState() {
	localStorage.setItem(V9_LOCAL_STATE, JSON.stringify(localState));
}

export function loadLocalState() {
	const ls = localStorageLoad(V9_LOCAL_STATE) as LocalState | null;
	setLocalState(
		produce((s) => {
			s.alwaysDisplaySkills = ls?.alwaysDisplaySkills ?? true;
			s.currentTab = ls?.currentTab ?? 0;
			s.exportIncludeDolls = ls?.exportIncludeDolls ?? false;
			s.exportDiscord = ls?.exportDiscord ?? false;
			s.exportAsLink = ls?.exportAsLink ?? false;
			s.exportIncludeSeason = ls?.exportIncludeSeason ?? false;
			s.exportIncludeBoss = ls?.exportIncludeBoss ?? false;
			s.skillDisplay = new Array(notations.size).fill(0) as number[];
			const importedSkillDisplay = ls?.skillDisplay ?? [];
			for (const [index, value] of importedSkillDisplay.entries()) {
				if (typeof value === "number") {
					s.skillDisplay[index] = value;
				}
			}
		})
	);
}

export function compareStateHash() {
	const storedState = localStorageLoad(V9_STORAGE_KEY) as SaveV9 | null;
	if (!storedState) return false;
	const clone = toSave();
	const oldState = {
		selectedDolls: storedState.selectedDolls,
		map: storedState.map,
		customMap: storedState.customMap,
		buffs: storedState.buffs ?? [],
		tabData: storedState.tabData,
	};
	const newState = {
		selectedDolls: clone.selectedDolls,
		map: clone.map,
		customMap: clone.customMap,
		buffs: clone.buffs ?? [],
		tabData: clone.tabData,
	};
	return JSON.stringify(oldState) === JSON.stringify(newState);
}

export function updateVisibleSkillOption(value: boolean) {
	setLocalState(
		produce((state) => {
			state.alwaysDisplaySkills = value;
		})
	);
}

/**
 * Every summon placement needs an instance id: an empty one makes the summon look like a doll to the map and the drag
 * code. A placement without one carries on the previous turn's instance of the same summon on the same tile, when this
 * turn doesn't already use that id; otherwise it gets a new one.
 */
function fillMissingInstanceIds(tabs: SaveV9TabData[]) {
	for (const [tabIndex, tab] of tabs.entries()) {
		const filled: string[] = [];
		for (const p of tab.summonPositions) {
			// the type says string, but a hand-edited or older save can leave it out
			if ((p.mapId as string | undefined)?.trim()) continue;
			const inThisTab = new Set(tab.summonPositions.map((q) => q.mapId));
			const previous = tabs[tabIndex - 1]?.summonPositions.find(
				(q) => summonBaseIdOf(q.id) === summonBaseIdOf(p.id) && q.x === p.x && q.y === p.y && q.mapId && !inThisTab.has(q.mapId)
			);
			p.mapId = previous?.mapId ?? nextSummonInstanceId(tabs);
			filled.push(`${p.id} at (${p.x}, ${p.y}) -> ${p.mapId}`);
		}
		if (filled.length) log.info(`Turn ${tabIndex}: gave summons without an instance id one`, filled);
	}
}

export function buildState(save: CurrentSave): SaveV9 {
	const selectedDolls = save.selectedDolls.map((d) => ({ ...d, keys: [...d.keys] }));
	// Resolve each doll once; throws for an ID the current game data doesn't know -> caught by importState
	const entities = selectedDolls.map((d) => ({ doll: d, summons: getSelectedDoll(d).summons.map((s) => s.id) }));
	const validIds = new Set<DollId | SummonId>(entities.flatMap((e) => [e.doll.id, ...e.summons]));

	// Only normalizes the shape: entries the current dolls can't resolve are kept as-is and reported by validateSave
	const tabData = Array.from({ length: 8 }, (_, i): SaveV9TabData => {
		const src = save.tabData[i] ?? makeDefaultTabData();
		const dollPositions: Record<DollId, Position> = structuredClone(src.dollPositions);
		const actions: Record<string, SaveV9Action[]> = structuredClone(src.actions);
		for (const { doll, summons } of entities) {
			dollPositions[doll.id] = { x: src.dollPositions[doll.id]?.x ?? -1, y: src.dollPositions[doll.id]?.y ?? -1 };
			for (const id of [doll.id, ...summons]) actions[id] ??= [];
		}
		// Keep the existing order, then append any selected entity that's missing
		const order = new Set(src.actionOrder);
		for (const id of validIds) order.add(id);
		return {
			actionOrder: [...order],
			actions,
			dollPositions,
			summonPositions: structuredClone(src.summonPositions),
		};
	});
	fillMissingInstanceIds(tabData);

	return {
		version: V9_SAVE_VERSION,
		selectedDolls,
		map: save.map,
		...embeddedMap(save),
		score: save.score ?? 0,
		description: save.description ?? "",
		buffs: [...(save.buffs ?? [])],
		tabData,
	};
}

/** The save's copy of its custom map, when it has a usable one; a broken copy is dropped and reported as an unknown map. */
function embeddedMap(save: CurrentSave): Pick<SaveV9, "customMap"> {
	if (save.customMap === undefined || isBuiltInMap(save.map)) return {};
	try {
		const map = checkMap(save.customMap);
		return map.name === save.map ? { customMap: map } : {};
	} catch (e) {
		log.warn(`The timeline's copy of map "${save.map}" couldn't be read`, e);
		return {};
	}
}

export async function applyState(next: SaveV9) {
	setState(reconcile(next)); // one store write; reconcile keeps fine-grained reactivity for unchanged parts
	loadMap(state.map); // prefers the timeline's own copy of a custom map over a slot with the same name
	setupTempSelectedDolls();
	await preloadCanvasImages();
}

export function toSave(s: SaveV9 = state): CurrentSave {
	const clone = structuredClone(unwrap(s));
	clone.version = V9_SAVE_VERSION;
	// only a custom map travels with the timeline
	if (clone.customMap && !isBuiltInMap(clone.map)) clone.customMap = toPlainMap(clone.customMap);
	else delete clone.customMap;
	clone.buffs.sort(sortBuffs);
	for (const doll of clone.selectedDolls) doll.keys.sort();
	return clone;
}

// export function loadState(newData: AppState & { version: number }) {
// 	log.info(`Incoming State`, newData);
// 	const version8State = version7To8Upgrade(newData);
// 	const incomingState = convertV8IdsToV9(version8State);
// 	log.info(`transformed State`, incomingState);
// 	setState(
// 		produce((s) => {
// 			s.selectedDolls = incomingState.selectedDolls;
// 			s.currentTab = incomingState.currentTab;
// 			s.map = incomingState.map;
// 			s.score = incomingState.score ?? 0;
// 			s.description = incomingState.description ?? "";
// 			s.buffs = incomingState.buffs ?? [];
// 			for (let tabIndex = 0; tabIndex < 8; tabIndex++) {
// 				const src = incomingState.tabData[tabIndex];
// 				const tab = s.tabData[tabIndex];
// 				tab.summonPositions.length = 0;
// 				tab.actionOrder.length = 0;
// 				tab.dollPositions = {};
// 				tab.actions = {};
// 				for (const doll of s.selectedDolls) {
// 					tab.dollPositions[doll.id] = {
// 						x: src.dollPositions[doll.id]?.x ?? -1,
// 						y: src.dollPositions[doll.id]?.y ?? -1,
// 					};
// 				}
// 				tab.summonPositions.push(...(src.summonPositions || []));
// 				tab.actionOrder.push(...(src.actionOrder || []));
// 				for (const doll of s.selectedDolls) {
// 					tab.actions[doll.id] = [...(src.actions[doll.id] ?? [])];
// 					const dollInfo = getSelectedDoll(doll);
// 					for (const summon of dollInfo.summons) {
// 						tab.actions[summon.id] = [...(src.actions[summon.id] ?? [])];
// 					}
// 				}
// 			}
// 		})
// 	);
// 	for (let i = 0; i < 8; i++) defaultActionOrder(i);
// 	setEditingMap(state.map);
// }

function describeSource(processFn: (data: string) => Promise<unknown>): string {
	if (processFn === loadFromWorker) return "Shared link (stateId)";
	if (processFn === loadFromString) return stateFromURL() ? "Shared link (state string)" : "Import panel";
	if (processFn === loadFromLocalStorage) return "Local save";
	return processFn.name || "unknown";
}

/** The failing save in a form that can be pasted back into the app: the state string, or the stateId plus its cached copy. */
async function describeSaveData(processFn: (data: string) => Promise<unknown>, data: string, raw: unknown): Promise<string[]> {
	if (processFn === loadFromString) return [`State: ${data.trim()}`];
	if (processFn === loadFromWorker) return [`State ID: ${data}`, `Cached state: ${localStorage.getItem(data) ?? "(not cached)"}`];
	if (raw == null) return ["State: (none)"];
	try {
		return [`State: ${await compressString(typeof raw === "string" ? raw : JSON.stringify(raw))}`];
	} catch {
		return ["State: (unavailable)"];
	}
}

interface ImportFailure {
	processFn: (data: string) => Promise<unknown>;
	data: string;
	raw: unknown;
	stage: string;
	error: unknown;
	chain: ReturnType<typeof currentChain>;
}

async function buildErrorDetails(failure: ImportFailure): Promise<string> {
	const { processFn, data, raw, stage, error, chain } = failure;
	const version = raw && typeof raw === "object" && "version" in raw ? String(raw.version) : "unknown";
	const errorText = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
	const stack = error instanceof Error && error.stack ? error.stack : "(none)";
	return [
		"Gunsmoke import error",
		`Time: ${new Date().toISOString()}`,
		`Page: ${window.location.href}`,
		`User agent: ${navigator.userAgent}`,
		`Source: ${describeSource(processFn)}`,
		`Failed while: ${stage}`,
		`Save version: ${version}`,
		`Error: ${errorText}`,
		`Log scope: ${chain.labels.join(" > ")} ${JSON.stringify(chain.context)}`,
		...(await describeSaveData(processFn, data, raw)),
		`Stack: ${stack}`,
	].join("\n");
}

export async function importState(processFn: (data: string) => Promise<unknown>, data: string): Promise<boolean> {
	using scope = logScope("importState", { source: processFn.name });
	const isLocal = processFn === loadFromLocalStorage;
	let raw: unknown;
	let stage = "loading save";
	try {
		raw = await processFn(data); // network / decompress / JSON.parse errors land in catch
		if (raw == null) throw new SaveImportError("No save data found");
		scope.add("version", (raw as { version?: unknown }).version);
		log.info("State before migration", raw);
		stage = "migrating save";
		const next = buildState(upgradeSave(raw));
		log.info("State after migration", structuredClone(next));
		stage = "applying save";
		await applyState(next); // the store is only touched once the data is valid
		stage = "validating and saving";
		const errors = validateSave(state);
		if (errors.length) {
			const messages = uniqueMessages(errors);
			log.warn(`Loaded timeline has ${messages.length} problem(s):\n- ${messages.join("\n- ")}`, errors);
		}
		if (!isLocal) setLocalState("currentTab", 8); // shared timelines open on the summary, as compress() used to force
		if (!stateFromURL()) saveToLocalStorage(); // local: re-saves migrated v7/v8 data under the v9 key; import panel: persists the import
		return true;
	} catch (e) {
		const chain = currentChain(); // before any await, so a sibling's scope can't leak in
		const details = await buildErrorDetails({ processFn, data, raw, stage, error: e, chain });
		log.error("Error importing state", e, "\n" + details);
		if (isLocal) {
			// Keep the bad save so it can be recovered, start from defaults, and do NOT overwrite the stored save
			if (raw !== undefined && raw !== null) {
				if (typeof raw === "string") {
					localStorage.setItem(FAILED_STATE_BACKUP_KEY, raw);
				} else {
					localStorage.setItem(FAILED_STATE_BACKUP_KEY, JSON.stringify(raw));
				}
			}
			pushImportError({
				message: "Your saved timeline couldn't be loaded, so an empty timeline was started. A backup of the old save was kept.",
				details,
			});
			await applyState(buildState(structuredClone(defaultState)));
			return false;
		}
		pushImportError({ message: "This timeline couldn't be loaded, so your locally saved timeline was opened instead.", details });
		setStateFromURL(false);
		window.history.replaceState({}, document.title, window.location.origin + window.location.pathname);
		return await importState(loadFromLocalStorage, ""); // can only recurse once, because the local path never recurses
	}
}

export function loadFromLocalStorage(_data: string): Promise<unknown> {
	return new Promise((resolve) => {
		const v9 = localStorageLoad(V9_STORAGE_KEY) as SaveV9 | null;
		if (v9 !== null) {
			resolve(v9);
			return;
		}
		const v8 = localStorageLoad(V8_STORAGE_KEY) as SaveV8 | null;
		if (v8 !== null) {
			resolve(v8);
			return;
		}
		const v7 = localStorageLoad(V7_STORAGE_KEY) as SaveV7 | null;
		if (v7 !== null) {
			resolve(v7);
			return;
		}
		resolve(structuredClone(defaultState));
	});
}

export async function loadFromString(data: string): Promise<unknown> {
	const decompressed = await decompress(data.trim());
	return JSON.parse(decompressed);
}

export async function loadFromWorker(stateId: string): Promise<unknown> {
	const cachedState = localStorage.getItem(stateId);
	if (cachedState !== null) {
		const decompressed = await decompress(cachedState);
		return JSON.parse(decompressed);
	}
	const res = await fetch(`https://gunsmoke.arkahnx.technology/state?stateId=${stateId}`);

	const data = (await res.json()) as ApiResponse<StateEntry>;
	if (data.error) {
		throw new SaveImportError(`Server couldn't load shared timeline "${stateId}": ${data.error}`);
	}
	if (data.result) {
		const decompressed = await decompress(data.result.state);
		const savedStates = localStorageLoad(SAVED_STATES_KEY) as string[] | null;
		if (!savedStates) {
			localStorage.setItem(SAVED_STATES_KEY, JSON.stringify([stateId]));
		} else {
			savedStates.push(stateId);
			if (savedStates.length > 10) {
				const removedState = savedStates.shift();
				if (removedState !== undefined) localStorage.removeItem(removedState);
			}
			localStorage.setItem(SAVED_STATES_KEY, JSON.stringify(savedStates));
		}
		localStorage.setItem(stateId, data.result.state);
		return JSON.parse(decompressed);
	}
	return null;
}

export async function compress(): Promise<string> {
	return await compressString(JSON.stringify(toSave()));
}

export async function compressString(json: string): Promise<string> {
	const byteArray = new TextEncoder().encode(json);
	const cs = new CompressionStream("deflate");
	// start consuming first: the write only resolves once its output is read, so awaiting it first never finishes
	const readPromise = new Response(cs.readable).arrayBuffer();
	const writer = cs.writable.getWriter();
	await writer.write(byteArray);
	await writer.close();
	const buf = await readPromise;
	return btoa(String.fromCharCode(...new Uint8Array(buf)))
		.replace(/\+/g, "-")
		.replace(/\//g, "_")
		.replace(/=+$/, "");
}

export async function decompress(b64: string): Promise<string> {
	const bytes = Uint8Array.from(atob(b64.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
	const ds = new DecompressionStream("deflate");
	const readPromise = new Response(ds.readable).arrayBuffer(); // start consuming first

	const writer = ds.writable.getWriter();
	await writer.write(bytes);
	await writer.close();

	return new TextDecoder().decode(await readPromise);
}
