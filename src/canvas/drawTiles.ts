import { cellX, cellY, getBoss, gridKey, mapGrid } from "../store/mapGrid";
import { FULL_HEIGHT, HALF_HEIGHT, TILE_SIZE } from "../types/constants";

export function drawFloor(ctx: CanvasRenderingContext2D, c: number, r: number) {
	const bossCoords = getBoss();
	const distance = Math.abs(c - bossCoords.x) + Math.abs(r - bossCoords.y);
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
	const labelW = Math.ceil(ctx.measureText(distance.toString()).width) + 4;
	ctx.fillRect(x + 6, y + 2, labelW, fontSize + 2);
	ctx.fillStyle = "#27272a";
	ctx.fillText(distance.toString(), x + 6, y + 2);
}

export function drawSpawn(ctx: CanvasRenderingContext2D, c: number, r: number) {
	const x = cellX(c);
	const y = cellY(r);
	const mapCoord = gridKey(c, r, mapGrid.width);
	const priority = mapGrid.priority.indexOf(mapCoord);
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

	// an unnumbered spawn gets no label rather than "0 Priority"
	if (priority === -1) return;
	ctx.font = `bold 5px Roboto, sans-serif`;
	ctx.textAlign = "left";
	ctx.textBaseline = "top";
	const text = (priority + 1).toString() + "\nPriority";
	const labelW = Math.ceil(ctx.measureText(text).width);
	ctx.fillStyle = "#4888ff";
	ctx.fillText(text, x + labelW / 5, y + 3);
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
	const x = cellX(c - 1),
		y = cellY(r - 1);
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
