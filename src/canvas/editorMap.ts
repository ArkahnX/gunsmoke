import { mapGrid, gridKey, getCell, hasCover, inMapBounds } from "../store";
import { MAP_SIZE, EDITOR_MAP_KEY } from "../types/constants";
import type { MapData } from "../types";

export function editorSerialize(): string {
	const tiles: MapData["tiles"] = [];
	const bndHSeen = new Set<string>(),
		bndVSeen = new Set<string>();
	for (const k in mapGrid) {
		const cell = mapGrid[k]!;
		const [c, r] = k.split(",").map(Number) as [number, number];
		if (cell.cover === "boss" && cell.bossOrigin?.[0] === c && cell.bossOrigin?.[1] === r) tiles.push({ type: "boss", c, r });
		else if (cell.cover === "hcov") tiles.push({ type: "hcov", c, r });
		else if (cell.cover === "fcov") tiles.push({ type: "fcov", c, r });
		if (cell.spawn) tiles.push({ type: "spawn", c, r });
		if (cell.bndH && !bndHSeen.has(k)) {
			bndHSeen.add(k);
			tiles.push({ type: "hbnd_h", c, r });
		}
		if (cell.bndV && !bndVSeen.has(k)) {
			bndVSeen.add(k);
			tiles.push({ type: "hbnd_v", c, r });
		}
	}
	return JSON.stringify({ cols: MAP_SIZE, rows: MAP_SIZE, tiles }, null, 2);
}

export function editorDeserialize(json: string) {
	for (const k in mapGrid) delete mapGrid[k];
	const data: MapData = JSON.parse(json);
	for (const t of data.tiles ?? []) {
		const { type, c, r } = t;
		if (type === "boss") {
			if (inMapBounds(c + 2, r + 2)) {
				for (let dr = 0; dr < 3; dr++)
					for (let dc = 0; dc < 3; dc++) {
						const cell = getCell(c + dc, r + dr);
						cell.cover = "boss";
						cell.bossOrigin = [c, r];
						cell.spawn = false;
						cell.bndH = false;
						cell.bndV = false;
					}
			}
		} else if (type === "hcov" || type === "fcov") {
			const cell = getCell(c, r);
			cell.cover = type;
			cell.spawn = false;
			cell.bndH = false;
			cell.bndV = false;
		} else if (type === "spawn") {
			if (!hasCover(c, r)) getCell(c, r).spawn = true;
		} else if (type === "hbnd_h") {
			if (inMapBounds(c, r + 1) && !hasCover(c, r) && !hasCover(c, r + 1)) getCell(c, r).bndH = true;
		} else if (type === "hbnd_v") {
			if (inMapBounds(c + 1, r) && !hasCover(c, r) && !hasCover(c + 1, r)) getCell(c, r).bndV = true;
		}
	}
}

export function saveEditorMap() {
	localStorage.setItem(EDITOR_MAP_KEY, editorSerialize());
}

export function loadEditorMap() {
	const saved = localStorage.getItem(EDITOR_MAP_KEY);
	if (saved) {
		try {
			editorDeserialize(saved);
			return;
		} catch {}
	}
	editorResetLayout();
}

export function editorClearAll() {
	for (const k in mapGrid) delete mapGrid[k];
	saveEditorMap();
}

export function editorResetLayout() {
	editorClearAll();
	const defs: [string, number, number][] = [
		["spawn", 10, 15],
		["spawn", 13, 15],
		["spawn", 7, 15],
		["spawn", 5, 12],
		["spawn", 5, 8],
		["spawn", 15, 12],
		["spawn", 15, 8],
		["spawn", 7, 5],
		["spawn", 10, 5],
		["spawn", 13, 5],
		["hcov", 6, 14],
		["hcov", 6, 15],
		["hcov", 13, 14],
		["hcov", 14, 14],
		["hcov", 14, 13],
		["hcov", 14, 12],
		["hcov", 14, 11],
		["hbnd_h", 12, 13],
		["hbnd_h", 7, 13],
		["hbnd_h", 8, 13],
		["hbnd_h", 9, 16],
		["hbnd_h", 10, 16],
		["hbnd_h", 11, 16],
		["fcov", 4, 12],
		["fcov", 4, 11],
		["hcov", 6, 9],
		["hcov", 6, 8],
		["hcov", 6, 7],
		["hcov", 7, 6],
		["hcov", 6, 6],
		["hbnd_h", 8, 6],
		["hbnd_h", 9, 3],
		["hbnd_h", 10, 3],
		["hbnd_h", 11, 3],
		["hbnd_h", 12, 6],
		["hbnd_h", 13, 6],
		["hcov", 14, 5],
		["hcov", 14, 6],
		["fcov", 16, 8],
		["fcov", 16, 9],
		["hcov", 5, 17],
		["hcov", 4, 17],
		["hcov", 3, 13],
		["hcov", 3, 14],
		["hcov", 3, 15],
		["hcov", 3, 16],
		["hcov", 3, 17],
		["hcov", 17, 14],
		["hcov", 17, 15],
		["hcov", 15, 17],
		["hcov", 16, 17],
		["hcov", 17, 17],
		["hcov", 17, 16],
		["hcov", 15, 3],
		["hcov", 16, 3],
		["hcov", 17, 3],
		["hcov", 17, 4],
		["hcov", 17, 5],
		["hcov", 17, 6],
		["hcov", 5, 3],
		["hcov", 4, 3],
		["hcov", 3, 3],
		["hcov", 3, 4],
		["hcov", 3, 5],
		["hcov", 3, 6],
		["hcov", 17, 7],
		["boss", 9, 9],
	];
	for (const [type, c, r] of defs) {
		if (type === "spawn") {
			if (!hasCover(c, r)) getCell(c, r).spawn = true;
		} else if (type === "hcov" || type === "fcov") {
			const cell = getCell(c, r);
			cell.cover = type as "hcov" | "fcov";
			cell.spawn = false;
			cell.bndH = false;
			cell.bndV = false;
		} else if (type === "boss") {
			if (c + 2 < MAP_SIZE && r + 2 < MAP_SIZE) {
				let blocked = false;
				for (let dr = 0; dr < 3 && !blocked; dr++)
					for (let dc = 0; dc < 3 && !blocked; dc++) if (hasCover(c + dc, r + dr)) blocked = true;
				if (!blocked) {
					for (let dr = 0; dr < 3; dr++)
						for (let dc = 0; dc < 3; dc++) {
							const cell = getCell(c + dc, r + dr);
							cell.cover = "boss";
							cell.bossOrigin = [c, r];
							cell.spawn = false;
							cell.bndH = false;
							cell.bndV = false;
						}
				}
			}
		} else if (type === "hbnd_h") {
			if (inMapBounds(c, r + 1) && !hasCover(c, r) && !hasCover(c, r + 1)) getCell(c, r).bndH = true;
		} else if (type === "hbnd_v") {
			if (inMapBounds(c + 1, r) && !hasCover(c, r) && !hasCover(c + 1, r)) getCell(c, r).bndV = true;
		}
	}
	saveEditorMap();
}
