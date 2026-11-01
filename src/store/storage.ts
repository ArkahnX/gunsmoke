import { log } from "../log";
import { V9_STORAGE_KEY } from "../types/constants";
import { toSave } from "./persistence";
import { setStateFromURL } from "./uiState";

/** The parsed JSON stored under `key`, or null. Unchecked: callers assert the shape they expect. */
export function localStorageLoad(key: string): unknown {
	try {
		const item = localStorage.getItem(key);
		if (!item) return null;
		return JSON.parse(item);
	} catch (e) {
		log.error("Error loading from localStorage", key, e);
		return null;
	}
}

export function saveToLocalStorage() {
	setStateFromURL(false);
	window.history.replaceState({}, document.title, window.location.origin + window.location.pathname);
	localStorage.setItem(V9_STORAGE_KEY, JSON.stringify(toSave()));
}
