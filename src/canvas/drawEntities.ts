import { IdKey } from "../../gfl2-data/enums";
import { AStarFinder } from "../lib/astar";
import { getEntityById, hasPrefix, isInertSummon } from "../store/gameData";
import { getImageForEntity, getImmobileIcon } from "../store/images";
import { cellCenter, mapGrid, pathfindingGrid } from "../store/mapGrid";
import { MapDollInfo, DragState, DragStatus } from "../types";
import { TILE_SIZE } from "../types/constants";

export function drawPath(ctx: CanvasRenderingContext2D, doll: MapDollInfo) {
	const aStarInstance = new AStarFinder({
		grid: pathfindingGrid(),
		diagonalAllowed: false,
		heuristic: "Manhattan",
	});
	const path = aStarInstance.findPath({ x: doll.x, y: doll.y }, { x: doll.oldX, y: doll.oldY });
	if (path.length === 0) return;
	ctx.beginPath();

	ctx.strokeStyle = "blue"; // Line color
	ctx.lineWidth = 4; // Line thickness
	ctx.lineCap = "round"; // Rounded corners
	ctx.lineJoin = "round";

	// Move to the starting coordinate
	ctx.moveTo(cellCenter(path[0][0]), cellCenter(path[0][1]));

	// Draw lines to every subsequent coordinate in the A* array
	for (let i = 1; i < path.length; i++) {
		ctx.lineTo(cellCenter(path[i][0]), cellCenter(path[i][1]));
	}

	// Render the drawn path
	ctx.stroke();
}

export function drawDollOnCanvas(ctx: CanvasRenderingContext2D, data: MapDollInfo) {
	if (!data.dollInfo) return;
	const cx = Math.round(data.x * TILE_SIZE + TILE_SIZE / 2);
	const cy = Math.round(data.y * TILE_SIZE + TILE_SIZE / 2);
	const r = Math.round(TILE_SIZE * 0.475);
	const avatarOffY = Math.round(TILE_SIZE * 0.06);
	const image = getImageForEntity(data.id);
	if (image) {
		ctx.save();
		if (
			(hasPrefix(data.id, IdKey.Summons) && data.instanceId === data.dragInstanceId) ||
			(hasPrefix(data.id, IdKey.Dolls) && data.id === data.dragId)
		) {
			// if this summon/doll is being dragged, make the icon mostly transparent
			ctx.globalAlpha = 0.25;
		}
		ctx.beginPath();
		ctx.arc(cx, cy - avatarOffY, r, 0, Math.PI * 2);
		ctx.clip();
		ctx.imageSmoothingEnabled = true;
		ctx.imageSmoothingQuality = "high";
		ctx.drawImage(image, cx - r, cy - avatarOffY - r, r * 2, r * 2);
		ctx.restore();
	}

	if (data.summonInfo) {
		ctx.beginPath();
		ctx.arc(cx, cy - avatarOffY, r + 2, 0, Math.PI * 2);
		ctx.strokeStyle = "#2dd4bf";
		ctx.lineWidth = 2;
		ctx.stroke();

		// bottom right of the avatar, centred on its edge
		const immobileIcon = getImmobileIcon();
		if (immobileIcon && isInertSummon(data.summonInfo)) {
			const size = Math.round(r * 0.7);
			const edge = Math.round(r * Math.SQRT1_2);
			drawImmobileBadge(ctx, immobileIcon, cx + edge - size / 2, cy - avatarOffY + edge - size / 2, size);
		}
	}
}

/** The chips' `.gf-badge-inert`: the immobile icon on a dark rounded square, `size` px across. */
function drawImmobileBadge(ctx: CanvasRenderingContext2D, icon: HTMLImageElement, x: number, y: number, size: number) {
	ctx.save();
	ctx.fillStyle = "#3a4246";
	ctx.beginPath();
	ctx.roundRect(x, y, size, size, size * 0.1);
	ctx.fill();
	// the badge's padding is a tenth of its width
	const padding = size * 0.1;
	ctx.imageSmoothingEnabled = true;
	ctx.imageSmoothingQuality = "high";
	ctx.drawImage(icon, x + padding, y + padding, size - padding * 2, size - padding * 2);
	ctx.restore();
}

export function drawDollLabelOnCanvas(ctx: CanvasRenderingContext2D, data: MapDollInfo) {
	if (!data.dollInfo) return;
	const cx = Math.round(data.x * TILE_SIZE + TILE_SIZE / 2);
	const cy = Math.round(data.y * TILE_SIZE + TILE_SIZE / 2);
	const r = Math.round(TILE_SIZE * 0.475);
	const avatarOffY = Math.round(TILE_SIZE * 0.06);
	const fontSize = Math.max(7, Math.round(TILE_SIZE * 0.28));
	ctx.font = `bold ${fontSize}px Roboto, sans-serif`;
	ctx.textAlign = "center";
	ctx.textBaseline = "top";
	let labelY = Math.round(cy + r - avatarOffY + 1);
	if (data.obscured) {
		labelY = Math.round(cy - r - avatarOffY + 1 - fontSize - 2);
	}
	let text = data.dollInfo.name;
	let color = "#ffffff";
	if (data.summonInfo) {
		text = data.summonInfo.name;
		color = "#2dd4bf";
	}
	const labelW = Math.ceil(ctx.measureText(text).width) + 4;
	ctx.fillStyle = "rgba(0,0,0,0.75)";
	ctx.fillRect(Math.round(cx - labelW / 2), labelY, labelW, fontSize + 2);
	ctx.fillStyle = color;
	ctx.fillText(text, cx, labelY + 1);
	if ((data.distance === "near" || data.distance === "far") && mapGrid.name === "Blade Guard Titan") {
		ctx.beginPath();
		ctx.arc(cx - avatarOffY - fontSize / 1.5, cy + avatarOffY + fontSize / 1.5, fontSize / 1.5, 0, Math.PI * 2);
		if (data.distance === "near") {
			ctx.fillStyle = "#0E76A1";
			ctx.fill();
			ctx.fillStyle = color;
			ctx.fillText("C", cx - avatarOffY - fontSize / 1.5, cy + avatarOffY + fontSize / 3);
		} else if (data.distance === "far") {
			ctx.fillStyle = "#FF6F19";
			ctx.fill();
			ctx.fillStyle = color;
			ctx.fillText("F", cx - avatarOffY - fontSize / 1.5, cy + avatarOffY + fontSize / 3);
		}
	}
}

export function drawGhostOnCanvas(ctx: CanvasRenderingContext2D, drag: DragState) {
	const dollOrSummon = getEntityById(drag.id);
	const image = getImageForEntity(drag.id);
	let cx = Math.round(drag.currentTileX * TILE_SIZE + TILE_SIZE / 2);
	let cy = Math.round(drag.currentTileY * TILE_SIZE + TILE_SIZE / 2);
	if (drag.status === DragStatus.Swap) {
		cx = Math.round(drag.currentTileX * TILE_SIZE + TILE_SIZE / 4);
		cy = Math.round(drag.currentTileY * TILE_SIZE + TILE_SIZE / 4);
	}
	const r = Math.round(TILE_SIZE * 0.475);
	const avatarOffY = Math.round(TILE_SIZE * 0.06);
	if (image) {
		ctx.save();
		ctx.globalAlpha = 0.6;
		ctx.beginPath();
		ctx.arc(cx, cy - avatarOffY, r, 0, Math.PI * 2);
		ctx.clip();
		ctx.imageSmoothingEnabled = true;
		ctx.imageSmoothingQuality = "high";
		ctx.drawImage(image, cx - r, cy - avatarOffY - r, r * 2, r * 2);
		ctx.restore();
	}
	ctx.save();
	ctx.beginPath();
	ctx.arc(cx, cy - avatarOffY, r + 2, 0, Math.PI * 2);
	if (drag.status === DragStatus.Swap) {
		ctx.strokeStyle = "#EFEFEF";
	} else if (drag.status === DragStatus.Valid) {
		ctx.strokeStyle = "#2dd4bf";
	} else {
		ctx.strokeStyle = "#D42D43";
	}
	ctx.lineWidth = 2;
	ctx.stroke();
	if (drag.status === DragStatus.Discard) {
		ctx.strokeStyle = "#D42D43";
		ctx.beginPath();
		ctx.moveTo(drag.currentTileX * TILE_SIZE, drag.currentTileY * TILE_SIZE);
		ctx.lineTo(drag.currentTileX * TILE_SIZE + TILE_SIZE, drag.currentTileY * TILE_SIZE + TILE_SIZE);
		ctx.stroke();
		ctx.beginPath();
		ctx.moveTo(drag.currentTileX * TILE_SIZE + TILE_SIZE, drag.currentTileY * TILE_SIZE);
		ctx.lineTo(drag.currentTileX * TILE_SIZE, drag.currentTileY * TILE_SIZE + TILE_SIZE);
		ctx.stroke();
	}
	ctx.restore();
	const fontSize = Math.max(7, Math.round(TILE_SIZE * 0.28));
	ctx.font = `bold ${fontSize}px Roboto, sans-serif`;
	ctx.textAlign = "center";
	ctx.textBaseline = "top";
	const labelY = Math.round(cy + r - avatarOffY + 1);
	const labelW = Math.ceil(ctx.measureText(dollOrSummon.name).width) + 4;
	ctx.fillStyle = "rgba(0,0,0,0.75)";
	ctx.fillRect(Math.round(cx - labelW / 2), labelY, labelW, fontSize + 2);
	ctx.fillStyle = "#ffffff";
	if (drag.status === DragStatus.Swap) {
		ctx.fillText("Swap", cx, labelY + 1);
	} else {
		ctx.fillText(dollOrSummon.name, cx, labelY + 1);
	}
}
