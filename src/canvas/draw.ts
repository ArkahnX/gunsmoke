import { gridKey, isTileType, mapGrid } from "../store/mapGrid";
import { DragState, TileType } from "../types";
import { getDollData } from "./dollGrid";
import { drawDollLabelOnCanvas, drawDollOnCanvas } from "./drawEntities";
import { drawBoss, drawFloor, drawFullCover, drawHalfCover, drawHBoundary, drawSpawn, drawVBoundary } from "./drawTiles";

export function drawMapTilesOnArena(ctx: CanvasRenderingContext2D, drag: DragState | null, currentTab: number) {
	const dolls = getDollData(drag, currentTab);
	for (let row = 0; row < mapGrid.height; row++) for (let col = 0; col < mapGrid.width; col++) drawFloor(ctx, col, row);
	for (let row = 0; row < mapGrid.height; row++) {
		for (let col = 0; col < mapGrid.width; col++) {
			const cell = mapGrid.tiles[gridKey(col, row)];
			const cellBelow = mapGrid.tiles[gridKey(col, row + 1)];
			const cellRight = mapGrid.tiles[gridKey(col + 1, row)];
			const doll = dolls.find((doll) => doll.x === col && doll.y === row);
			if (currentTab < 1) {
				if (isTileType(cell, TileType.Spawn)) drawSpawn(ctx, col, row);
			}
			if (doll) {
				drawDollOnCanvas(ctx, doll);
			}
			if (!cell) continue;
			if (isTileType(cell, TileType.HBoundary) && isTileType(cellBelow, TileType.HBoundary)) drawHBoundary(ctx, col, row);
			if (isTileType(cell, TileType.VBoundary) && isTileType(cellRight, TileType.VBoundary)) drawVBoundary(ctx, col, row);
			if (isTileType(cell, TileType.BossOrigin)) drawBoss(ctx, col, row);
			else if (isTileType(cell, TileType.HalfCover)) drawHalfCover(ctx, col, row);
			else if (isTileType(cell, TileType.FullCover)) drawFullCover(ctx, col, row);
		}
	}
	// draw labels on a separate loop to ensure they are always on top
	for (let row = 0; row < mapGrid.height; row++) {
		for (let col = 0; col < mapGrid.width; col++) {
			const doll = dolls.find((doll) => doll.x === col && doll.y === row);
			if (doll) {
				// TODO in the future, add capability to show doll movement via drawPath
				// drawPath(ctx, doll);
				drawDollLabelOnCanvas(ctx, doll);
			}
		}
	}
}
