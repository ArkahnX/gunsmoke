import { camera } from "../components/ArenaCanvas";
import { MapGrid, TileType } from "../types";
import { TILE_SIZE } from "../types/constants";
import { setState } from "./appState";

export const mapGrid: MapGrid = { id: "default", name: "Default", width: 21, height: 21, priority: [], tiles: [] };

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

export function gridKey(x: number, y: number, width?: number): number {
	return y * (width ?? mapGrid.width) + x;
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
	return c >= 0 && c < mapGrid.width && r >= 0 && r < mapGrid.height;
}
export function isTileType(tile: TileType, type: TileType): boolean {
	return ((tile & type) as TileType) === type;
}
export function getCell(column: number, row: number): TileType {
	if (!inMapBounds(column, row)) {
		console.error("Out of bound tile", column, row, mapGrid.width, mapGrid.height);
		return TileType.Empty;
	}
	return mapGrid.tiles[row * mapGrid.width + column];
}
function indexToCoords(index: number, width: number): { x: number; y: number } {
	const x = index % width;
	const y = Math.floor(index / width);
	return { x, y };
}
export function getBoss() {
	const bossIndex = mapGrid.tiles.findIndex((tile) => isTileType(tile, TileType.BossOrigin));
	if (bossIndex > -1) {
		return indexToCoords(bossIndex, mapGrid.width);
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

export function setMap(name: string, id: string, width: number, height: number, tiles: TileType[], priority: number[]) {
	setState("map", name);
	fillGrid({ id, name, width, height, tiles, priority });
}

/** Shows `map` on the canvases without changing which map the timeline uses (the editor draws its slot this way). */
export function fillGrid(map: MapGrid) {
	mapGrid.name = map.name;
	mapGrid.id = map.id;
	mapGrid.width = map.width;
	mapGrid.height = map.height;
	mapGrid.tiles.length = 0;
	mapGrid.priority.length = 0;
	mapGrid.priority.push(...map.priority);
	mapGrid.tiles.push(...map.tiles);
	camera.x = (mapGrid.width * TILE_SIZE) / 2;
	camera.y = (mapGrid.height * TILE_SIZE) / 2;
}

export function setCell(x: number, y: number, value: TileType, merge?: boolean) {
	const index = gridKey(x, y);
	mapGrid.tiles[index] = merge ? mapGrid.tiles[index] | value : value;
	// a tile that stops being a spawn loses its priority, and the spawns after it move up
	if (!isTileType(mapGrid.tiles[index], TileType.Spawn)) setPriority(index, null);
}

/**
 * Moves the spawn at tile `index` to `rank` (1 = deployed first), or removes its rank when `rank` is null.
 * Ranks stay consecutive: the spawns after a removed one move up, and a rank past the end appends.
 */
export function setPriority(index: number, rank: number | null) {
	const current = mapGrid.priority.indexOf(index);
	if (current > -1) mapGrid.priority.splice(current, 1);
	if (rank === null || !isTileType(mapGrid.tiles[index], TileType.Spawn)) return;
	mapGrid.priority.splice(Math.max(0, Math.min(rank - 1, mapGrid.priority.length)), 0, index);
}

/** Which edge or corner stays put when the map is resized: 0 = left/top, 1 = centre, 2 = right/bottom. */
export interface ResizeAnchor {
	x: 0 | 1 | 2;
	y: 0 | 1 | 2;
}

/**
 * Resizes the map, keeping the tiles at `anchor` where they are. Tiles and priorities that fall outside are dropped,
 * and so is a boss that no longer fits whole.
 */
export function resizeMap(width: number, height: number, anchor: ResizeAnchor) {
	const offset = (grow: number, side: 0 | 1 | 2) => (side === 0 ? 0 : side === 2 ? grow : Math.floor(grow / 2));
	const dx = offset(width - mapGrid.width, anchor.x);
	const dy = offset(height - mapGrid.height, anchor.y);
	const moved = (index: number) => {
		const { x, y } = indexToCoords(index, mapGrid.width);
		const nx = x + dx;
		const ny = y + dy;
		return nx >= 0 && nx < width && ny >= 0 && ny < height ? gridKey(nx, ny, width) : -1;
	};
	const tiles = Array(width * height).fill(TileType.Empty) as TileType[];
	for (const [index, tile] of mapGrid.tiles.entries()) {
		const to = moved(index);
		if (to > -1) tiles[to] = tile;
	}
	const priority = mapGrid.priority.map(moved).filter((index) => index > -1);
	const boss = mapGrid.tiles.findIndex((tile) => isTileType(tile, TileType.BossOrigin));
	if (boss > -1) {
		const { x, y } = indexToCoords(boss, mapGrid.width);
		const fits = x + dx - 1 >= 0 && x + dx + 1 < width && y + dy - 1 >= 0 && y + dy + 1 < height;
		if (!fits) for (const [index, tile] of tiles.entries()) tiles[index] = tile & ~(TileType.BossCover | TileType.BossOrigin);
	}
	fillGrid({ id: mapGrid.id, name: mapGrid.name, width, height, tiles, priority });
}

export function unsetBoss() {
	for (const [index, tile] of mapGrid.tiles.entries()) {
		if (isTileType(tile, TileType.BossCover) || isTileType(tile, TileType.BossOrigin)) {
			mapGrid.tiles[index] = mapGrid.tiles[index] & ~TileType.BossCover;
			mapGrid.tiles[index] = mapGrid.tiles[index] & ~TileType.BossOrigin;
		}
	}
}

function _debugCell(tile: TileType) {
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
