import { TILE_SIZE, MAP_SIZE, HALF_HEIGHT, FULL_HEIGHT } from "../types/constants";
import { mapGrid, gridKey, cellX, cellY, state, getInfoFromId } from "../store";
import type { SummonData, SummonPosition, DollData, DragState, DollInfo } from "../types";

// ─── Editor Draw Functions ─────────────────────────────────────────────────
export function drawFloor(ctx: CanvasRenderingContext2D, c: number, r: number) {
	const distance = Math.abs(c - 10) + Math.abs(r - 10);
	const x = cellX(c),
		y = cellY(r);
	ctx.fillStyle = "#18181b";
	ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
	ctx.strokeStyle = "#27272a";
	ctx.lineWidth = 1;
	ctx.strokeRect(x + 0.5, y + 0.5, TILE_SIZE - 1, TILE_SIZE - 1);

	const fontSize = Math.max(7, Math.round(TILE_SIZE * 0.28));
	ctx.font = `bold ${fontSize}px Roboto, sans-serif`;
	ctx.textAlign = "center";
	ctx.textBaseline = "top";
	const labelW = Math.ceil(ctx.measureText(distance + "").width) + 4;
	ctx.fillRect(x + 6, y + 2, labelW, fontSize + 2);
	ctx.fillStyle = "#27272a";
	ctx.fillText(distance + "", x + 6, y + 2);
}

export function drawSpawn(ctx: CanvasRenderingContext2D, c: number, r: number) {
	const x = cellX(c),
		y = cellY(r);
	ctx.fillStyle = "rgba(18,60,180,0.18)";
	ctx.fillRect(x + 1, y + 1, TILE_SIZE - 2, TILE_SIZE - 2);
	ctx.strokeStyle = "#3070ee";
	ctx.lineWidth = 1;
	ctx.strokeRect(x + 1.5, y + 1.5, TILE_SIZE - 3, TILE_SIZE - 3);
	ctx.strokeStyle = "rgba(60,120,255,0.25)";
	ctx.lineWidth = 1;
	ctx.strokeRect(x + 4.5, y + 4.5, TILE_SIZE - 9, TILE_SIZE - 9);
	const cx2 = Math.round(x + TILE_SIZE / 2),
		cy2 = Math.round(y + TILE_SIZE / 2);
	ctx.beginPath();
	ctx.moveTo(cx2 - 6, cy2 - 3);
	ctx.lineTo(cx2 - 6, cy2 + 3);
	ctx.moveTo(cx2 + 6, cy2 - 3);
	ctx.lineTo(cx2 + 6, cy2 + 3);
	ctx.strokeStyle = "#4888ff";
	ctx.lineWidth = 1;
	ctx.stroke();
	ctx.beginPath();
	ctx.moveTo(cx2 - 6, cy2);
	ctx.lineTo(cx2 - 2, cy2);
	ctx.moveTo(cx2 + 2, cy2);
	ctx.lineTo(cx2 + 6, cy2);
	ctx.strokeStyle = "#4888ff";
	ctx.lineWidth = 1;
	ctx.stroke();
	ctx.beginPath();
	ctx.moveTo(cx2 - 2, cy2 - 3);
	ctx.lineTo(cx2 + 3, cy2);
	ctx.lineTo(cx2 - 2, cy2 + 3);
	ctx.closePath();
	ctx.fillStyle = "#4888ff";
	ctx.fill();
}

export function drawHBoundary(ctx: CanvasRenderingContext2D, c: number, r: number) {
	const x = cellX(c),
		y = cellY(r),
		THICK = 5;
	const wy = y + TILE_SIZE - Math.floor(THICK / 2);
	ctx.fillStyle = "#2e2618";
	ctx.fillRect(x, wy - 1, TILE_SIZE, THICK);
	ctx.fillStyle = "#453a28";
	ctx.fillRect(x, wy - 1, TILE_SIZE, 2);
	const posts = [x + Math.round(TILE_SIZE * 0.1), x + Math.round(TILE_SIZE * 0.45), x + Math.round(TILE_SIZE * 0.8)];
	posts.forEach((px) => {
		ctx.fillStyle = "#554535";
		ctx.fillRect(px - 2, wy - 2, 4, THICK + 2);
	});
	ctx.fillStyle = "#100e08";
	ctx.fillRect(x + Math.round(TILE_SIZE * 0.1) + 2, wy + 1, Math.round(TILE_SIZE * 0.33) - 2, THICK - 3);
	ctx.fillRect(x + Math.round(TILE_SIZE * 0.45) + 2, wy + 1, Math.round(TILE_SIZE * 0.33) - 2, THICK - 3);
	ctx.strokeStyle = "#706040";
	ctx.lineWidth = 1;
	ctx.beginPath();
	ctx.moveTo(x, wy - 0.5);
	ctx.lineTo(x + TILE_SIZE, wy - 0.5);
	ctx.stroke();
}

export function drawVBoundary(ctx: CanvasRenderingContext2D, c: number, r: number) {
	const x = cellX(c),
		y = cellY(r),
		THICK = 5;
	const wx = x + TILE_SIZE - Math.floor(THICK / 2);
	ctx.fillStyle = "#2e2618";
	ctx.fillRect(wx - 1, y, THICK, TILE_SIZE);
	ctx.fillStyle = "#453a28";
	ctx.fillRect(wx - 1, y, 2, TILE_SIZE);
	const posts = [y + Math.round(TILE_SIZE * 0.1), y + Math.round(TILE_SIZE * 0.45), y + Math.round(TILE_SIZE * 0.8)];
	posts.forEach((py) => {
		ctx.fillStyle = "#554535";
		ctx.fillRect(wx - 2, py - 2, THICK + 2, 4);
	});
	ctx.fillStyle = "#100e08";
	ctx.fillRect(wx + 1, y + Math.round(TILE_SIZE * 0.1) + 2, THICK - 3, Math.round(TILE_SIZE * 0.33) - 2);
	ctx.fillRect(wx + 1, y + Math.round(TILE_SIZE * 0.45) + 2, THICK - 3, Math.round(TILE_SIZE * 0.33) - 2);
	ctx.strokeStyle = "#706040";
	ctx.lineWidth = 1;
	ctx.beginPath();
	ctx.moveTo(wx - 0.5, y);
	ctx.lineTo(wx - 0.5, y + TILE_SIZE);
	ctx.stroke();
}

export function drawHalfCover(ctx: CanvasRenderingContext2D, c: number, r: number) {
	const x = cellX(c),
		y = cellY(r);
	const blockTop = y - HALF_HEIGHT,
		fullH = TILE_SIZE + HALF_HEIGHT;
	ctx.fillStyle = "#28401e";
	ctx.fillRect(x, blockTop, TILE_SIZE, fullH);
	ctx.fillStyle = "#344f28";
	ctx.fillRect(x + 1, blockTop + 1, TILE_SIZE - 2, TILE_SIZE - 2);
	ctx.strokeStyle = "#44622e";
	ctx.lineWidth = 1;
	ctx.strokeRect(x + 3.5, blockTop + 3.5, TILE_SIZE - 7, TILE_SIZE - 7);
	const midY = Math.round(blockTop + TILE_SIZE / 2) + 0.5;
	ctx.beginPath();
	ctx.moveTo(x + 2, midY);
	ctx.lineTo(x + TILE_SIZE - 2, midY);
	ctx.strokeStyle = "#2a3e20";
	ctx.lineWidth = 1;
	ctx.stroke();
	ctx.fillStyle = "#1e2e14";
	ctx.fillRect(x + 1, blockTop + TILE_SIZE, TILE_SIZE - 2, HALF_HEIGHT - 1);
	ctx.strokeStyle = "#4e6838";
	ctx.lineWidth = 1;
	ctx.beginPath();
	ctx.moveTo(x, blockTop + 0.5);
	ctx.lineTo(x + TILE_SIZE, blockTop + 0.5);
	ctx.stroke();
	ctx.strokeStyle = "#3a5028";
	ctx.lineWidth = 1;
	ctx.beginPath();
	ctx.moveTo(x, blockTop + TILE_SIZE + 0.5);
	ctx.lineTo(x + TILE_SIZE, blockTop + TILE_SIZE + 0.5);
	ctx.stroke();
	ctx.strokeStyle = "#1a2810";
	ctx.lineWidth = 1;
	ctx.beginPath();
	ctx.moveTo(x + 0.5, blockTop);
	ctx.lineTo(x + 0.5, blockTop + fullH);
	ctx.stroke();
	ctx.beginPath();
	ctx.moveTo(x + TILE_SIZE - 0.5, blockTop);
	ctx.lineTo(x + TILE_SIZE - 0.5, blockTop + fullH);
	ctx.stroke();
}

export function drawFullCover(ctx: CanvasRenderingContext2D, c: number, r: number) {
	const x = cellX(c),
		y = cellY(r);
	const blockTop = y - FULL_HEIGHT,
		fullH = TILE_SIZE + FULL_HEIGHT;
	ctx.fillStyle = "#301e0a";
	ctx.fillRect(x, blockTop, TILE_SIZE, fullH);
	ctx.fillStyle = "#3e2810";
	ctx.fillRect(x + 1, blockTop + 1, TILE_SIZE - 2, TILE_SIZE - 2);
	ctx.strokeStyle = "#5a3e1e";
	ctx.lineWidth = 1;
	ctx.strokeRect(x + 3.5, blockTop + 3.5, TILE_SIZE - 7, TILE_SIZE - 7);
	const midX = Math.round(x + TILE_SIZE / 2) + 0.5;
	const midY = Math.round(blockTop + TILE_SIZE / 2) + 0.5;
	ctx.beginPath();
	ctx.moveTo(midX, blockTop + 3);
	ctx.lineTo(midX, blockTop + TILE_SIZE - 3);
	ctx.moveTo(x + 3, midY);
	ctx.lineTo(x + TILE_SIZE - 3, midY);
	ctx.strokeStyle = "#2c1c08";
	ctx.lineWidth = 1;
	ctx.stroke();
	ctx.fillStyle = "#221406";
	ctx.fillRect(x + 1, blockTop + TILE_SIZE, TILE_SIZE - 2, FULL_HEIGHT - 1);
	ctx.strokeStyle = "#6e5030";
	ctx.lineWidth = 1;
	ctx.beginPath();
	ctx.moveTo(x, blockTop + 0.5);
	ctx.lineTo(x + TILE_SIZE, blockTop + 0.5);
	ctx.stroke();
	ctx.strokeStyle = "#4c3418";
	ctx.lineWidth = 1;
	ctx.beginPath();
	ctx.moveTo(x, blockTop + TILE_SIZE + 0.5);
	ctx.lineTo(x + TILE_SIZE, blockTop + TILE_SIZE + 0.5);
	ctx.stroke();
	ctx.strokeStyle = "#180e04";
	ctx.lineWidth = 1;
	ctx.beginPath();
	ctx.moveTo(x + 0.5, blockTop);
	ctx.lineTo(x + 0.5, blockTop + fullH);
	ctx.stroke();
	ctx.beginPath();
	ctx.moveTo(x + TILE_SIZE - 0.5, blockTop);
	ctx.lineTo(x + TILE_SIZE - 0.5, blockTop + fullH);
	ctx.stroke();
}

export function drawBoss(ctx: CanvasRenderingContext2D, c: number, r: number) {
	const x = cellX(c),
		y = cellY(r);
	const W = TILE_SIZE * 3,
		topY = y - FULL_HEIGHT,
		blockBodyH = TILE_SIZE * 3,
		fullH = blockBodyH + FULL_HEIGHT;
	ctx.fillStyle = "#1e0606";
	ctx.fillRect(x, topY, W, fullH);
	ctx.fillStyle = "#280c0c";
	ctx.fillRect(x + 1, topY + 1, W - 2, blockBodyH - 2);
	ctx.fillStyle = "#160404";
	ctx.fillRect(x + 1, topY + blockBodyH, W - 2, FULL_HEIGHT - 1);
	for (let i = 1; i < 3; i++) {
		ctx.strokeStyle = "#1e0808";
		ctx.lineWidth = 1;
		ctx.beginPath();
		ctx.moveTo(x + TILE_SIZE * i + 0.5, topY);
		ctx.lineTo(x + TILE_SIZE * i + 0.5, topY + blockBodyH);
		ctx.stroke();
		ctx.beginPath();
		ctx.moveTo(x, topY + TILE_SIZE * i + 0.5);
		ctx.lineTo(x + W, topY + TILE_SIZE * i + 0.5);
		ctx.stroke();
	}
	ctx.strokeStyle = "#701818";
	ctx.lineWidth = 1;
	ctx.strokeRect(x + 3.5, topY + 3.5, W - 7, blockBodyH - 7);
	ctx.beginPath();
	ctx.moveTo(x + 10, topY + 10);
	ctx.lineTo(x + W - 10, topY + blockBodyH - 10);
	ctx.moveTo(x + W - 10, topY + 10);
	ctx.lineTo(x + 10, topY + blockBodyH - 10);
	ctx.strokeStyle = "#501010";
	ctx.lineWidth = 1;
	ctx.stroke();
	ctx.strokeStyle = "#aa5050";
	ctx.lineWidth = 1;
	ctx.beginPath();
	ctx.moveTo(x, topY + 0.5);
	ctx.lineTo(x + W, topY + 0.5);
	ctx.stroke();
	ctx.strokeStyle = "#883838";
	ctx.lineWidth = 1;
	ctx.beginPath();
	ctx.moveTo(x, topY + blockBodyH + 0.5);
	ctx.lineTo(x + W, topY + blockBodyH + 0.5);
	ctx.stroke();
	ctx.strokeStyle = "#200808";
	ctx.lineWidth = 1;
	ctx.beginPath();
	ctx.moveTo(x + 0.5, topY);
	ctx.lineTo(x + 0.5, topY + fullH);
	ctx.stroke();
	ctx.beginPath();
	ctx.moveTo(x + W - 0.5, topY);
	ctx.lineTo(x + W - 0.5, topY + fullH);
	ctx.stroke();
	ctx.font = "500 11px sans-serif";
	ctx.fillStyle = "#cc6060";
	ctx.textAlign = "center";
	ctx.textBaseline = "middle";
	ctx.fillText("BOSS", x + W / 2, topY + blockBodyH / 2);
}

// ─── Shared map tile renderer ──────────────────────────────────────────────
function obscured(x: number, y: number, dollGrid?: Record<string, DollInfo>) {
	const tileBelow = mapGrid[gridKey(x, y + 1)];
	const currentTile = mapGrid[gridKey(x, y)];
	if (currentTile) {
		if (currentTile.bndH || currentTile.bndV) return true;
	}
	if (tileBelow) {
		if (tileBelow.cover === "boss" || tileBelow.cover === "hcov" || tileBelow.cover === "fcov") return true;
	}
	if (dollGrid) {
		const doll = dollGrid[gridKey(x, y + 1)];
		if (doll) return true;
	}
	return false;
}

export function drawMapTilesOnArena(ctx: CanvasRenderingContext2D, drag: DragState | null, currentTab: number) {
	const dolls: Record<string, DollInfo> = {};
	state.selectedDolls.forEach((doll) => {
		const pos = state.tabData[currentTab]?.dollPositions[doll.id] ?? { x: -1, y: -1 };
		if (pos.x === -1 || pos.y === -1) return;
		const tileBelow = mapGrid[gridKey(pos.x, pos.y + 1)];
		dolls[gridKey(pos.x, pos.y)] = {
			x: pos.x,
			y: pos.y,
			id: doll.id,
			instanceId: null,
			dollInfo: getInfoFromId(doll.id) as DollData,
			summonInfo: null,
			dragId: drag?.id,
			dragInstanceId: drag?.instanceId,
			obscured: obscured(pos.x, pos.y),
		};
	});
	if (currentTab >= 1) {
		state.tabData[currentTab]!.summonPositions.forEach((entry) => {
			const summon = getInfoFromId(entry.id) as SummonData;
			if (summon) {
				const tileBelow = mapGrid[gridKey(entry.x, entry.y + 1)];
				dolls[gridKey(entry.x, entry.y)] = {
					x: entry.x,
					y: entry.y,
					id: entry.id,
					instanceId: entry.mapId,
					dollInfo: getInfoFromId(summon.dollId) as DollData,
					summonInfo: summon,
					dragId: drag?.id,
					dragInstanceId: drag?.instanceId,
					obscured: obscured(entry.x, entry.y),
				};
			}
		});
	}
	for (const [grid, entry] of Object.entries(dolls)) {
		entry.obscured = obscured(entry.x, entry.y, dolls);
	}
	for (let row = 0; row < MAP_SIZE; row++) for (let col = 0; col < MAP_SIZE; col++) drawFloor(ctx, col, row);
	for (let row = 0; row < MAP_SIZE; row++) {
		for (let col = 0; col < MAP_SIZE; col++) {
			const cell = mapGrid[gridKey(col, row)];
			const doll = dolls[gridKey(col, row)];
			if (currentTab < 1) {
				if (cell?.spawn) drawSpawn(ctx, col, row);
			}
			if (doll) {
				drawDollOnCanvas(ctx, doll);
			}
			if (!cell) continue;
			if (cell.bndH) drawHBoundary(ctx, col, row);
			if (cell.bndV) drawVBoundary(ctx, col, row);
			if (cell.cover === "boss" && cell.bossOrigin?.[0] === col && cell.bossOrigin?.[1] === row) drawBoss(ctx, col, row);
			else if (cell.cover === "hcov") drawHalfCover(ctx, col, row);
			else if (cell.cover === "fcov") drawFullCover(ctx, col, row);
		}
	}
}

// ─── Doll / Summon on canvas ────────────────────────────────────────────────
export function drawDollOnCanvas(ctx: CanvasRenderingContext2D, data: DollInfo) {
	if (!data.dollInfo) return;
	const cx = Math.round(data.x * TILE_SIZE + TILE_SIZE / 2);
	const cy = Math.round(data.y * TILE_SIZE + TILE_SIZE / 2);
	const r = Math.round(TILE_SIZE * 0.475);
	const avatarOffY = Math.round(TILE_SIZE * 0.06);
	if (data.summonInfo && data.summonInfo.preloadedImage?.complete) {
		ctx.save();
		if (data.instanceId === data.dragInstanceId) {
			// if this summon is being dragged, make the icon mostly transparent
			ctx.globalAlpha = 0.25;
		}
		ctx.beginPath();
		ctx.arc(cx, cy - avatarOffY, r, 0, Math.PI * 2);
		ctx.clip();
		ctx.imageSmoothingEnabled = true;
		ctx.imageSmoothingQuality = "high";
		ctx.drawImage(data.summonInfo.preloadedImage, cx - r, cy - avatarOffY - r, r * 2, r * 2);
		ctx.restore();
	} else if (data.dollInfo.preloadedImage?.complete) {
		ctx.save();
		if (data.id === data.dragId) {
			// if this doll is being dragged, make the icon mostly transparent
			ctx.globalAlpha = 0.25;
		}
		ctx.beginPath();
		ctx.arc(cx, cy - avatarOffY, r, 0, Math.PI * 2);
		ctx.clip();
		ctx.imageSmoothingEnabled = true;
		ctx.imageSmoothingQuality = "high";
		ctx.drawImage(data.dollInfo.preloadedImage, cx - r, cy - avatarOffY - r, r * 2, r * 2);
		ctx.restore();
	}
	const fontSize = Math.max(7, Math.round(TILE_SIZE * 0.28));
	ctx.font = `bold ${fontSize}px Roboto, sans-serif`;
	ctx.textAlign = "center";
	ctx.textBaseline = "top";
	let labelY = Math.round(cy + r - avatarOffY + 1);
	if (data.obscured) {
		labelY = Math.round(cy - r - avatarOffY + 1 - fontSize - 2);
	}
	ctx.fillStyle = "rgba(0,0,0,0.75)";
	if (data.summonInfo) {
		ctx.beginPath();
		ctx.arc(cx, cy - avatarOffY, r + 2, 0, Math.PI * 2);
		ctx.strokeStyle = "#2dd4bf";
		ctx.lineWidth = 2;
		ctx.stroke();
		const labelW = Math.ceil(ctx.measureText(data.summonInfo.name).width) + 4;
		ctx.fillRect(Math.round(cx - labelW / 2), labelY, labelW, fontSize + 2);
		ctx.fillStyle = "#2dd4bf";
		ctx.fillText(data.summonInfo.name, cx, labelY + 1);
	} else {
		const labelW = Math.ceil(ctx.measureText(data.dollInfo.name).width) + 4;
		ctx.fillRect(Math.round(cx - labelW / 2), labelY, labelW, fontSize + 2);
		ctx.fillStyle = "#ffffff";
		ctx.fillText(data.dollInfo.name, cx, labelY + 1);
	}
}

export function drawGhostOnCanvas(ctx: CanvasRenderingContext2D, tileX: number, tileY: number, dollId: string, valid: boolean) {
	if (!dollId) return;
	const info = getInfoFromId(dollId);
	if (!info) return;
	const cx = Math.round(tileX * TILE_SIZE + TILE_SIZE / 2);
	const cy = Math.round(tileY * TILE_SIZE + TILE_SIZE / 2);
	const r = Math.round(TILE_SIZE * 0.475);
	const avatarOffY = Math.round(TILE_SIZE * 0.06);
	if (info.preloadedImage?.complete) {
		ctx.save();
		ctx.globalAlpha = 0.6;
		ctx.beginPath();
		ctx.arc(cx, cy - avatarOffY, r, 0, Math.PI * 2);
		ctx.clip();
		ctx.imageSmoothingEnabled = true;
		ctx.imageSmoothingQuality = "high";
		ctx.drawImage(info.preloadedImage, cx - r, cy - avatarOffY - r, r * 2, r * 2);
		ctx.restore();
	}
	ctx.save();
	ctx.beginPath();
	ctx.arc(cx, cy - avatarOffY, r + 2, 0, Math.PI * 2);
	if (valid) {
		ctx.strokeStyle = "#2dd4bf";
	} else {
		ctx.strokeStyle = "#D42D43";
	}
	ctx.lineWidth = 2;
	ctx.stroke();
	ctx.restore();
	const fontSize = Math.max(7, Math.round(TILE_SIZE * 0.28));
	ctx.font = `bold ${fontSize}px Roboto, sans-serif`;
	ctx.textAlign = "center";
	ctx.textBaseline = "top";
	const labelY = Math.round(cy + r - avatarOffY + 1);
	const labelW = Math.ceil(ctx.measureText(info.name).width) + 4;
	ctx.fillStyle = "rgba(0,0,0,0.75)";
	ctx.fillRect(Math.round(cx - labelW / 2), labelY, labelW, fontSize + 2);
	ctx.fillStyle = "#ffffff";
	ctx.fillText(info.name, cx, labelY + 1);
}

export function drawSummonOnCanvas(
	ctx: CanvasRenderingContext2D,
	entry: SummonPosition,
	summon: SummonData,
	summonId: string | null | undefined,
	instanceId: string | null | undefined
) {
	const summonInfo = getInfoFromId(summon.id);
	if (!summonInfo) return;
	const cx = Math.round(entry.x * TILE_SIZE + TILE_SIZE / 2);
	const cy = Math.round(entry.y * TILE_SIZE + TILE_SIZE / 2);
	const r = Math.round(TILE_SIZE * 0.33);
	const avatarOffY = Math.round(TILE_SIZE * 0.06);
	ctx.save();
	ctx.beginPath();
	ctx.arc(cx, cy - avatarOffY, r + 2, 0, Math.PI * 2);
	ctx.strokeStyle = "#2dd4bf";
	ctx.lineWidth = 2;
	ctx.stroke();
	ctx.restore();
	if (summonInfo.preloadedImage?.complete) {
		ctx.save();
		if (summonId === entry.id && instanceId === entry.mapId) {
			// if this summon is being dragged, make the icon mostly transparent
			ctx.globalAlpha = 0.25;
		}
		ctx.beginPath();
		ctx.arc(cx, cy - avatarOffY, r, 0, Math.PI * 2);
		ctx.clip();
		ctx.imageSmoothingEnabled = true;
		ctx.imageSmoothingQuality = "high";
		ctx.drawImage(summonInfo.preloadedImage, cx - r, cy - avatarOffY - r, r * 2, r * 2);
		ctx.restore();
	} else {
		ctx.save();
		ctx.beginPath();
		ctx.arc(cx, cy - avatarOffY, r, 0, Math.PI * 2);
		ctx.fillStyle = "#0f4f4a";
		ctx.fill();
		ctx.restore();
	}
	const fontSize = Math.max(6, Math.round(TILE_SIZE * 0.22));
	ctx.font = `bold ${fontSize}px Roboto, sans-serif`;
	ctx.textAlign = "center";
	ctx.textBaseline = "top";
	const labelY = Math.round(cy + r - avatarOffY + 2);
	const labelW = Math.ceil(ctx.measureText(summonInfo.name).width) + 4;
	ctx.fillStyle = "rgba(0,0,0,0.75)";
	ctx.fillRect(Math.round(cx - labelW / 2), labelY, labelW, fontSize + 2);
	ctx.fillStyle = "#2dd4bf";
	ctx.fillText(summonInfo.name, cx, labelY + 1);
}
