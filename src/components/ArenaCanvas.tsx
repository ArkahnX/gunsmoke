import { onMount } from "solid-js";
import { state, setState, zoom, offsetX, offsetY, placeDoll, placeSummon, saveToLocalStorage, mapGrid } from "../store";
import { TILE_SIZE, CANVAS_SIZE, MAP_BOUNDS, MIN_SCALE, MAX_SCALE, MAP_SIZE } from "../types/constants";
import { drawMapTilesOnArena, drawGhostOnCanvas } from "../canvas/draw";
import { produce } from "solid-js/store";
import { ArenaCanvasProps, Camera, DragState } from "../types";

// TODO note; canvasEl may not be defined outside of ArenaCanvas
let canvasEl!: HTMLCanvasElement;
let ctx: CanvasRenderingContext2D;
let dpr: number = 1;
let draggingCharId: string | null = null;

const camera: Camera = { x: MAP_BOUNDS.maxX / 2, y: MAP_BOUNDS.maxY / 2, scale: 2 };

// Mouse pan state
let isPanning = false;
let lastMouse = { x: 0, y: 0 };

// Touch state
const activeTouches: Map<number, { x: number; y: number }> = new Map();
let lastPinchDist: number | null = null;

let drag: DragState | null = null;
let nextObjId = 1;

// ─── Object helpers ────────────────────────────────────────────────────────

function tileKey(col: number, row: number): string {
	return `${col},${row}`;
}

function getObjectAtWorld(tileX: number, tileY: number): DragState | null {
	const tab = state.tabData[state.currentTab]!;
	for (const [dollId, position] of Object.entries(tab.dollPositions)) {
		if (position.x === tileX && position.y === tileY) {
			return {
				id: dollId,
				instanceId: null,
				screenX: 0,
				screenY: 0,
				currentTileX: position.x,
				currentTileY: position.y,
				isValid: true,
			};
		}
	}
	for (const position of tab.summonPositions) {
		if (position.x === tileX && position.y === tileY) {
			return {
				id: position.id,
				instanceId: position.mapId,
				screenX: 0,
				screenY: 0,
				currentTileX: position.x,
				currentTileY: position.y,
				isValid: true,
			};
		}
	}
	return null;
}

function commitDrop(tileX: number, tileY: number, id: string, instanceId: string | null): void {
	const isOccupied = isDollAtTile(tileX, tileY, id, instanceId);
	const isValid = isValidMapPosition(tileX, tileY) && !isOccupied;

	if (isValid) {
		if (instanceId) {
			placeSummon(id, instanceId, tileX, tileY);
		} else {
			placeDoll(id, tileX, tileY);
		}
	}
}

// ─── HiDPI ─────────────────────────────────────────────────────────────────

/**
 * Size the canvas pixel buffer to CSS size × devicePixelRatio.
 * The CSS size stays unchanged so the element occupies the same layout space.
 * All drawing goes through applyCamera() which folds dpr into the transform.
 */
function fitToWindow(): void {
	dpr = window.devicePixelRatio || 1;

	const cssW = window.innerWidth;
	const cssH = window.innerHeight;

	canvasEl.style.width = `${cssW}px`;
	canvasEl.style.height = `${cssH}px`;
	canvasEl.width = Math.round(cssW * dpr);
	canvasEl.height = Math.round(cssH * dpr);

	// After resize the minimum zoom may change — re-clamp
	clampCamera();
}

// ─── Coordinate conversion ─────────────────────────────────────────────────

/** CSS pixel → world coordinate (dpr-agnostic: use offsetX/offsetY or clientX/clientY). */
function screenToWorld(sx: number, sy: number): { x: number; y: number; tileX: number; tileY: number } {
	const cssW = canvasEl.width / dpr;
	const cssH = canvasEl.height / dpr;
	const x = (sx - cssW / 2) / camera.scale + camera.x;
	const y = (sy - cssH / 2) / camera.scale + camera.y;
	return {
		x,
		tileX: Math.floor(x / TILE_SIZE),
		y,
		tileY: Math.floor(y / TILE_SIZE),
	};
}

/** World coordinate → CSS pixel. */
function worldToScreen(wx: number, wy: number): { x: number; y: number } {
	const cssW = canvasEl.width / dpr;
	const cssH = canvasEl.height / dpr;
	return {
		x: (wx - camera.x) * camera.scale + cssW / 2,
		y: (wy - camera.y) * camera.scale + cssH / 2,
	};
}

// ─── Bounds & clamping ─────────────────────────────────────────────────────

/**
 * Returns the minimum scale that prevents the map from being smaller than
 * the viewport in either axis. Ensures at least the full map fits on screen.
 */
function minScaleForBounds(): number {
	const cssW = canvasEl.width / dpr;
	const cssH = canvasEl.height / dpr;
	const scaleX = cssW / MAP_BOUNDS.maxX;
	const scaleY = cssH / MAP_BOUNDS.maxY;
	return Math.max(MIN_SCALE, Math.min(scaleX, scaleY));
}

/**
 * Clamps camera.scale, then clamps camera.x/y so the viewport can never
 * pan outside the map rectangle.
 *
 * The half-viewport in world units represents how far the camera centre can
 * move from the map edge before that edge scrolls off screen:
 *
 *   halfW = (cssWidth / 2) / scale
 *
 * camera.x must stay in [mapMinX + halfW, mapMaxX - halfW].
 * If the map is narrower than the viewport, centre it instead.
 */
function clampCamera(): void {
	const cssW = canvasEl.width / dpr;
	const cssH = canvasEl.height / dpr;

	// Clamp scale
	const minScale = minScaleForBounds();
	camera.scale = Math.max(minScale, Math.min(MAX_SCALE, camera.scale));

	const halfW = cssW / 2 / camera.scale;
	const halfH = cssH / 2 / camera.scale;

	const mapW = MAP_BOUNDS.maxX - MAP_BOUNDS.minX;
	const mapH = MAP_BOUNDS.maxY - MAP_BOUNDS.minY;

	if (mapW <= halfW * 2) {
		// Map narrower than viewport → centre horizontally
		camera.x = MAP_BOUNDS.minX + mapW / 2;
	} else {
		camera.x = Math.max(MAP_BOUNDS.minX + halfW, Math.min(MAP_BOUNDS.maxX - halfW, camera.x));
	}

	if (mapH <= halfH * 2) {
		camera.y = MAP_BOUNDS.minY + mapH / 2;
	} else {
		camera.y = Math.max(MAP_BOUNDS.minY + halfH, Math.min(MAP_BOUNDS.maxY - halfH, camera.y));
	}
}

// ─── Zoom ──────────────────────────────────────────────────────────────────

/**
 * Zoom toward a CSS-space point (e.g. mouse or touch midpoint).
 * Records world position under point before scale change, then shifts
 * the camera so that same world point remains under the cursor after.
 */
function zoomAt(cssPx: number, cssPy: number, factor: number): void {
	const before = screenToWorld(cssPx, cssPy);
	camera.scale *= factor;
	clampCamera(); // clamps scale first
	const after = screenToWorld(cssPx, cssPy);
	camera.x += before.x - after.x;
	camera.y += before.y - after.y;
	clampCamera(); // re-clamp position after shift
}

// ─── Camera transform ──────────────────────────────────────────────────────

/**
 * Sets the canvas transform so all subsequent draw calls are in world space.
 * Folds in dpr so the pixel buffer is sharp on HiDPI displays.
 *
 *   bufferPixel = worldUnit × scale × dpr   +   offset
 */
function applyCamera(): void {
	const cssW = canvasEl.width / dpr;
	const cssH = canvasEl.height / dpr;
	const s = camera.scale * dpr;
	const tx = (cssW / 2 - camera.x * camera.scale) * dpr;
	const ty = (cssH / 2 - camera.y * camera.scale) * dpr;
	ctx.setTransform(s, 0, 0, s, tx, ty);
}

// ─── Rendering ─────────────────────────────────────────────────────────────

function draw(): void {
	if (!ctx) return;
	if (state.currentTab < 0 || state.currentTab > 7) return;
	const { width, height } = canvasEl;

	// Reset to identity before clearing (covers full pixel buffer)
	ctx.setTransform(1, 0, 0, 1, 0, 0);
	ctx.clearRect(0, 0, width, height);

	applyCamera();
	drawMapTilesOnArena(ctx, drag, state.currentTab);
	if (drag) {
		drawGhostOnCanvas(ctx, drag.currentTileX, drag.currentTileY, drag.id, drag.isValid);
	}
}

function loop(): void {
	draw();
	requestAnimationFrame(() => loop());
}

// ─── External drag public API ───────────────────────────────────────────────

// ★ NEW
// Called by buildStagingArea when the user starts dragging a staging token.
// Attaches transient window-level listeners that track the pointer until release.
export function beginExternalDrag(id: string, instanceId: string | null, e: MouseEvent | TouchEvent): void {
	const getXY = (ev: MouseEvent | TouchEvent) =>
		"touches" in ev
			? { x: ev.touches[0].clientX, y: ev.touches[0].clientY }
			: { x: (ev as MouseEvent).clientX, y: (ev as MouseEvent).clientY };

	const { x, y } = getXY(e);

	drag = {
		id,
		instanceId,
		screenX: x,
		screenY: y,
		currentTileX: -1,
		currentTileY: -1,
		isValid: false,
	};

	// ★ NEW helper — update ghost position and target tile
	const onMove = (ev: MouseEvent | TouchEvent) => {
		if (!drag) return;
		const { x: cx, y: cy } = getXY(ev);
		drag.screenX = cx;
		drag.screenY = cy;
		updateExternalDrag(cx, cy);
	};

	// ★ NEW helper — commit or cancel on pointer up
	const onUp = (ev: MouseEvent | TouchEvent) => {
		window.removeEventListener("mousemove", onMove);
		window.removeEventListener("mouseup", onUp);
		window.removeEventListener("touchmove", onMove);
		window.removeEventListener("touchend", onUp);

		if (drag?.isValid) {
			commitExternalDrop(drag.currentTileX, drag.currentTileY, id, instanceId);
		}
		drag = null;
	};

	window.addEventListener("mousemove", onMove);
	window.addEventListener("mouseup", onUp);
	window.addEventListener("touchmove", onMove, { passive: false });
	window.addEventListener("touchend", onUp);
}

// ★ NEW — converts the screen position to a tile and checks validity
function updateExternalDrag(clientX: number, clientY: number): void {
	if (!drag) return;

	const rect = canvasEl.getBoundingClientRect();
	const overCanvas = clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom;

	if (!overCanvas) {
		drag.currentTileX = -1;
		drag.currentTileY = -1;
		drag.isValid = false;
		return;
	}

	const cssX = clientX - rect.left;
	const cssY = clientY - rect.top;
	const world = screenToWorld(cssX, cssY);
	const col = Math.floor(world.x / TILE_SIZE);
	const row = Math.floor(world.y / TILE_SIZE);

	const isOccupied = isDollAtTile(col, row, drag.id, drag.instanceId);
	const isValid = isValidMapPosition(col, row) && !isOccupied;

	drag.currentTileX = col;
	drag.currentTileY = row;
	drag.isValid = isValid;
}

// ★ NEW — places a brand-new GameObject on the map at the ghost's tile
function commitExternalDrop(tileX: number, tileY: number, id: string, instanceId: string | null): void {
	const isOccupied = isDollAtTile(tileX, tileY, id, instanceId);
	const isValid = isValidMapPosition(tileX, tileY) && !isOccupied;

	if (isValid) {
		if (instanceId) {
			placeSummon(id, instanceId, tileX, tileY);
		} else {
			placeDoll(id, tileX, tileY);
		}
	}
}

// ─── Touch events ──────────────────────────────────────────────────────────

/**
 * Strategy:
 *  - Track all active touches by identifier in activeTouches.
 *  - 1 touch  → pan by delta of that finger.
 *  - 2 touches → pan by midpoint delta + zoom by distance ratio.
 *  - 3+ touches → ignore (treat as no gesture).
 *
 * All coordinates are in CSS pixels (clientX/clientY), matching screenToWorld.
 */

function handleTouchStart(e: TouchEvent): void {
	e.preventDefault();
	for (const t of Array.from(e.changedTouches)) {
		activeTouches.set(t.identifier, { x: t.clientX, y: t.clientY });
	}
	// ★ NEW — if exactly one finger lands on an object, drag it
	if (activeTouches.size === 1 && !drag) {
		const [touch] = e.changedTouches;
		const rect = canvasEl.getBoundingClientRect();
		const world = screenToWorld(touch.clientX - rect.left, touch.clientY - rect.top);
		const hit = getObjectAtWorld(world.tileX, world.tileY);
		if (hit) {
			drag = hit;
		}
	}

	// If a second finger appears during an object drag, cancel the drag and switch to pan
	if (activeTouches.size === 2 && drag) {
		drag = null;
	}
	lastPinchDist = getPinchDist();
}

function handleTouchMove(e: TouchEvent): void {
	e.preventDefault();
	const count = activeTouches.size;
	if (count < 1 || count > 2) return;

	const prevTouches = new Map(activeTouches);

	// Update positions
	for (const t of Array.from(e.changedTouches)) {
		if (activeTouches.has(t.identifier)) {
			activeTouches.set(t.identifier, { x: t.clientX, y: t.clientY });
		}
	}

	// ★ NEW — single finger on a dragged object → update ghost
	if (count === 1 && drag) {
		const [touch] = e.changedTouches;
		const rect = canvasEl.getBoundingClientRect();
		const world = screenToWorld(touch.clientX - rect.left, touch.clientY - rect.top);
		updateDrag(world.tileX, world.tileY);
		return;
	}

	if (count === 1) {
		const [id] = activeTouches.keys();
		const prev = prevTouches.get(id)!;
		const curr = activeTouches.get(id)!;
		camera.x -= (curr.x - prev.x) / camera.scale;
		camera.y -= (curr.y - prev.y) / camera.scale;
		clampCamera();
	} else {
		// 2-finger: pan midpoint + zoom
		const [idA, idB] = activeTouches.keys();
		const currA = activeTouches.get(idA)!;
		const currB = activeTouches.get(idB)!;
		const prevA = prevTouches.get(idA)!;
		const prevB = prevTouches.get(idB)!;

		const prevMid = { x: (prevA.x + prevB.x) / 2, y: (prevA.y + prevB.y) / 2 };
		const currMid = { x: (currA.x + currB.x) / 2, y: (currA.y + currB.y) / 2 };

		// Pan by midpoint delta
		camera.x -= (currMid.x - prevMid.x) / camera.scale;
		camera.y -= (currMid.y - prevMid.y) / camera.scale;

		// Zoom by distance ratio, centred on the midpoint
		const prevDist = Math.hypot(prevA.x - prevB.x, prevA.y - prevB.y);
		const currDist = Math.hypot(currA.x - currB.x, currA.y - currB.y);
		if (prevDist > 0) {
			zoomAt(currMid.x, currMid.y, currDist / prevDist);
		}
	}
}

function handleTouchEnd(e: TouchEvent): void {
	e.preventDefault();
	// ★ NEW — finger lifting ends a drag
	if (drag && activeTouches.size === 1) {
		endDrag();
	}
	for (const t of Array.from(e.changedTouches)) {
		activeTouches.delete(t.identifier);
	}
	lastPinchDist = getPinchDist();
}

function getPinchDist(): number | null {
	const pts = Array.from(activeTouches.values());
	if (pts.length !== 2) return null;
	return Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
}

// ─── Drag helpers ──────────────────────────────────────────────────────────

function isDollAtTile(tileX: number, tileY: number, id: string, instanceId: string | null): boolean {
	const tab = state.tabData[state.currentTab]!;
	for (const [dollId, pos] of Object.entries(tab.dollPositions)) {
		if (pos.x === tileX && pos.y === tileY && dollId !== id) return true;
	}
	for (const summon of tab.summonPositions) {
		if (summon.x === tileX && summon.y === tileY && summon.id !== id && summon.mapId !== instanceId) return true;
	}
	return false;
}

function isValidMapPosition(tileX: number, tileY: number): boolean {
	const cell = mapGrid[tileKey(tileX, tileY)];
	const isSetup = state.currentTab === 0;
	const isSpawnTile = cell && cell.spawn;
	const isBlocked = cell && (cell.cover === "boss" || cell.cover === "hcov" || cell.cover === "fcov");
	const inBounds = tileX >= 0 && tileX < MAP_SIZE && tileY >= 0 && tileY < MAP_SIZE;
	return inBounds && ((isSetup && isSpawnTile) || (!isSetup && !isBlocked));
}

// ★ NEW — recalculate which tile the pointer is over and whether it's a valid drop
function updateDrag(tileX: number, tileY: number): void {
	if (!drag) return;

	const isOccupied = isDollAtTile(tileX, tileY, drag.id, drag.instanceId);
	const isValid = isValidMapPosition(tileX, tileY) && !isOccupied;

	drag.currentTileX = tileX;
	drag.currentTileY = tileY;
	drag.isValid = isValid;
}

// ★ NEW — commit or cancel the drop and clear drag state
function endDrag(): void {
	if (!drag) return;
	if (drag.isValid) {
		commitDrop(drag.currentTileX, drag.currentTileY, drag.id, drag.instanceId);
	}
	drag = null;
}

// ─── Resize ────────────────────────────────────────────────────────────────

function bindResize(): void {
	window.addEventListener("resize", () => fitToWindow());
	// Re-check dpr changes (browser zoom, moving window between displays)
	window.matchMedia(`(resolution: ${dpr}dppx)`).addEventListener("change", () => fitToWindow());
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function getWorldPos(clientX: number, clientY: number) {
	const rect = canvasEl.getBoundingClientRect();
	const scaleRatio = CANVAS_SIZE / rect.width;
	const mx = (clientX - rect.left) * scaleRatio;
	const my = (clientY - rect.top) * scaleRatio;
	return {
		col: Math.floor((mx - offsetX()) / (TILE_SIZE * zoom())),
		row: Math.floor((my - offsetY()) / (TILE_SIZE * zoom())),
	};
}

export default function ArenaCanvas(props: ArenaCanvasProps) {
	onMount(() => {
		ctx = canvasEl.getContext("2d")!;
		fitToWindow();
		bindResize();
		loop();
	});

	const handleMouseDown = (e: MouseEvent) => {
		if (e.button !== 0) return;
		const world = screenToWorld(e.offsetX, e.offsetY);
		const hit = getObjectAtWorld(world.tileX, world.tileY);
		if (hit) {
			drag = hit;
		} else {
			isPanning = true;
			lastMouse = { x: e.clientX, y: e.clientY };
		}
	};

	const handleMouseMove = (e: MouseEvent) => {
		const world = screenToWorld(e.offsetX, e.offsetY);
		props.onCoordsChange(`${String(world.tileX).padStart(2, "0")},${String(world.tileY).padStart(2, "0")}`);
		if (drag) {
			updateDrag(world.tileX, world.tileY);
		} else if (isPanning) {
			const dx = e.clientX - lastMouse.x;
			const dy = e.clientY - lastMouse.y;
			camera.x -= dx / camera.scale;
			camera.y -= dy / camera.scale;
			clampCamera();
			lastMouse = { x: e.clientX, y: e.clientY };
		}
	};

	const handleMouseUp = () => {
		if (drag) {
			endDrag();
		}
		isPanning = false;
	};

	const handleWheel = (e: WheelEvent) => {
		e.preventDefault();
		const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
		zoomAt(e.offsetX, e.offsetY, factor);
	};

	const handleDragOver = (e: DragEvent) => e.preventDefault();

	const handleDrop = (e: DragEvent) => {
		e.preventDefault();
		const raw = e.dataTransfer?.getData("text/plain") ?? "";
		const pos = getWorldPos(e.clientX, e.clientY);
		if (raw.startsWith("summon:")) {
			const parts = raw.split(":");
			placeSummon(parts[1]!, parts[2]!, pos.col, pos.row);
		} else {
			const parts = raw.split(":");
			placeDoll(parts[1]!, pos.col, pos.row);
		}
	};

	const handleContextMenu = (e: MouseEvent) => {
		e.preventDefault();
		if (state.currentTab < 1 || state.currentTab > 7) return;
		const pos = getWorldPos(e.clientX, e.clientY);
		setState(
			produce((s) => {
				const summons = s.tabData[s.currentTab]!.summonPositions;
				for (let i = summons.length - 1; i >= 0; i--) {
					if (summons[i]!.x === pos.col && summons[i]!.y === pos.row) {
						summons.splice(i, 1);
						break;
					}
				}
			})
		);
		saveToLocalStorage();
	};

	return (
		<canvas
			ref={canvasEl}
			class="shadow-2xl"
			onMouseDown={handleMouseDown}
			onMouseMove={handleMouseMove}
			onMouseUp={handleMouseUp}
			onMouseLeave={() => {
				// TODO REWRITE
				isPanning = false;
				draggingCharId = null;
			}}
			onTouchStart={handleTouchStart}
			onTouchMove={handleTouchMove}
			onTouchEnd={handleTouchEnd}
			onTouchCancel={handleTouchEnd}
			onDragOver={handleDragOver}
			onDrop={handleDrop}
			onWheel={handleWheel}
			onContextMenu={handleContextMenu}
		/>
	);
}
