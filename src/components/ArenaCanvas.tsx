import { createSignal, onMount } from "solid-js";
import {
	state,
	placeDoll,
	placeSummon,
	mapGrid,
	removeDollOrSummon,
	setCoords,
	coords,
	gridKey,
	swapPositions,
	isTileType,
} from "../store";
import { TILE_SIZE, MIN_SCALE, MAX_SCALE, MAP_SIZE } from "../types/constants";
import { drawMapTilesOnArena, drawGhostOnCanvas } from "../canvas/draw";
import { createStore, produce } from "solid-js/store";
import { Camera, DragState, DragStatus, MapBounds, TileType } from "../types";
import Discard from "./icons/Discard";
import Modal from "./modals/Modal";
import SetupSidebar from "./SetupSidebar";
import ActionSidebar from "./ActionSidebar";

let canvasEl!: HTMLCanvasElement;
let ctx: CanvasRenderingContext2D;
let dpr: number = 1;

export const camera: Camera = { x: 10, y: 10, scale: 2 };

const activePointers: Map<number, { x: number; y: number }> = new Map();

const [activeTab, setActiveTab] = createSignal("setup");
const [discardHover, setDiscardHover] = createSignal(false);

const [drag, setDrag] = createStore<DragState>({
	id: "",
	instanceId: "",
	screenX: -1,
	screenY: -1,
	currentTileX: -1,
	currentTileY: -1,
	status: DragStatus.Valid,
	isActive: false,
});

// ─── Pointer Events ────────────────────────────────────────────────────────

export function handlePointerDown(e: PointerEvent) {
	e.preventDefault();
	activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
	if (activePointers.size === 1) {
		// determine if we should start dragging a doll or pan the canvas
		const world = screenToWorld(e.clientX, e.clientY);
		const hit = getObjectAtWorld(world.tileX, world.tileY);
		if (hit) {
			setDrag(
				produce((d) => {
					d.id = hit.id;
					d.instanceId = hit.instanceId;
					d.screenX = e.clientX;
					d.screenY = e.clientY;
					d.currentTileX = hit.currentTileX;
					d.currentTileY = hit.currentTileY;
					d.isActive = true;
					d.status = getDragStatus(world.tileX, world.tileY, hit.id, hit.instanceId);
				})
			);
		}
	} else {
		// cancel any ongoing doll dragging if more than one pointer is present
		setDrag(
			produce((d) => {
				d.isActive = false;
			})
		);
	}
}

export function handlePointerMove(e: PointerEvent) {
	e.preventDefault();
	const world = screenToWorld(e.clientX, e.clientY);
	setCoords(`${String(world.tileX).padStart(2, "0")},${String(world.tileY).padStart(2, "0")}`);
	// If the number of pointers is not 1 or 2, do nothing
	if (activePointers.size < 1 || activePointers.size > 2) return;
	const previousPointers = new Map(activePointers);
	activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

	if (activePointers.size === 1) {
		if (drag.isActive) {
			updateDragInfo(e.clientX, e.clientY);
		} else {
			// pan canvas
			const prev = previousPointers.get(e.pointerId)!;
			const dx = e.clientX - prev.x;
			const dy = e.clientY - prev.y;
			camera.x -= dx / camera.scale;
			camera.y -= dy / camera.scale;
			clampCamera();
		}
	} else {
		// zoom canvas
		const [idA, idB] = activePointers.keys();
		const currA = activePointers.get(idA)!;
		const currB = activePointers.get(idB)!;
		const prevA = previousPointers.get(idA)!;
		const prevB = previousPointers.get(idB)!;

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

export function handlePointerUp(e: PointerEvent) {
	e.preventDefault();
	e.stopPropagation();
	activePointers.delete(e.pointerId);
	if (activePointers.size === 0) {
		AddDollToMap(drag);
		setDrag(
			produce((d) => {
				d.isActive = false;
			})
		);
	}
}

export function deployFromSetupPanel(id: string, instanceId: string | null, e: PointerEvent): void {
	e.preventDefault();
	canvasEl.setPointerCapture(e.pointerId);
	activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
	if (activePointers.size === 1) {
		const world = screenToWorld(e.clientX, e.clientY);
		setDrag(
			produce((d) => {
				d.id = id;
				d.instanceId = instanceId;
				d.screenX = e.clientX;
				d.screenY = e.clientY;
				d.currentTileX = world.tileX;
				d.currentTileY = world.tileY;
				d.isActive = true;
				d.status = getDragStatus(world.tileX, world.tileY, id, instanceId);
			})
		);
	}

	const onMove = (ev: PointerEvent) => {
		if (drag.isActive) {
			updateDragInfo(ev.clientX, ev.clientY);
		}
	};

	const onUp = (ev: PointerEvent) => {
		window.removeEventListener("pointermove", onMove);
		window.removeEventListener("pointerup", onUp);

		handlePointerUp(ev);
	};

	window.addEventListener("pointermove", onMove);
	window.addEventListener("pointerup", onUp);
}

export function handleDiscardEnter(e: PointerEvent) {
	e.preventDefault();
	if (!drag.isActive) return;
	setDiscardHover(true);
}

export function handleDiscardLeave(e: PointerEvent) {
	e.preventDefault();
	setDiscardHover(false);
}

// ─── Zoom Events ────────────────────────────────────────────────────────

export function handleWheel(e: WheelEvent) {
	e.preventDefault();
	const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
	zoomAt(e.clientX, e.clientY, factor);
}

/**
 * Zoom toward a CSS-space point (e.g. mouse or touch midpoint).
 * Records world position under point before scale change, then shifts
 * the camera so that same world point remains under the cursor after.
 */
function zoomAt(clientX: number, clientY: number, factor: number): void {
	const before = screenToWorld(clientX, clientY);
	camera.scale *= factor;
	clampCamera(); // clamps scale first
	const after = screenToWorld(clientX, clientY);
	camera.x += before.x - after.x;
	camera.y += before.y - after.y;
	clampCamera(); // re-clamp position after shift
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
 */
function clampCamera(): void {
	const MAP_BOUNDS = {
		minX: 0,
		minY: 0,
		maxX: mapGrid.size * TILE_SIZE,
		maxY: mapGrid.size * TILE_SIZE,
	};
	const cssW = canvasEl.width / dpr;
	const cssH = canvasEl.height / dpr;

	// Clamp scale
	const minScale = minScaleForBounds();
	camera.scale = Math.max(minScale, Math.min(MAX_SCALE, camera.scale));

	const halfW = cssW / 2 / camera.scale;
	const halfH = cssH / 2 / camera.scale;

	// Clamp X: camera can pan until only one tile remains visible on either side
    camera.x = Math.max(
        MAP_BOUNDS.minX - halfW + TILE_SIZE,   // left limit: left edge + one tile
        Math.min(
            MAP_BOUNDS.maxX + halfW - TILE_SIZE, // right limit: right edge - one tile
            camera.x
        )
    );

    // Clamp Y: same logic vertically
    camera.y = Math.max(
        MAP_BOUNDS.minY - halfH + TILE_SIZE,
        Math.min(
            MAP_BOUNDS.maxY + halfH - TILE_SIZE,
            camera.y
        )
    );
}

/**
 * Returns the minimum scale that prevents the map from being smaller than
 * the viewport in either axis. Ensures at least the full map fits on screen.
 */
function minScaleForBounds(): number {
	const cssW = canvasEl.width / dpr;
	const cssH = canvasEl.height / dpr;
	const scaleX = cssW / (mapGrid.size * TILE_SIZE);
	const scaleY = cssH / (mapGrid.size * TILE_SIZE);
	return Math.max(MIN_SCALE, Math.min(scaleX, scaleY));
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
	if (drag.isActive) {
		drawGhostOnCanvas(ctx, drag);
	}
}

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

function loop(): void {
	draw();
	requestAnimationFrame(() => loop());
}

// ─── Map Helpers ──────────────────────────────────────────────────────────

/** CSS pixel → world coordinate (dpr-agnostic: use offsetX/offsetY or clientX/clientY). */
function screenToWorld(clientX: number, clientY: number): { x: number; y: number; tileX: number; tileY: number } {
	const rect = canvasEl.getBoundingClientRect();
	const screenX = clientX - rect.left;
	const screenY = clientY - rect.top;
	const cssW = canvasEl.width / dpr;
	const cssH = canvasEl.height / dpr;
	const x = (screenX - cssW / 2) / camera.scale + camera.x;
	const y = (screenY - cssH / 2) / camera.scale + camera.y;
	return {
		x,
		tileX: Math.floor(x / TILE_SIZE),
		y,
		tileY: Math.floor(y / TILE_SIZE),
	};
}

function getDragStatus(tileX: number, tileY: number, id: string, instanceId: string | null): DragStatus {
	if (discardHover()) return DragStatus.Discard;
	const cell = mapGrid.tiles[gridKey(tileX, tileY)];
	const isSetup = state.currentTab === 0;
	const isSpawnTile = isTileType(cell, TileType.Spawn);
	const inBounds = tileX >= 0 && tileX < MAP_SIZE && tileY >= 0 && tileY < MAP_SIZE;
	const isBlocked =
		isTileType(cell, TileType.HalfCover) ||
		isTileType(cell, TileType.FullCover) ||
		isTileType(cell, TileType.BossCover) ||
		isTileType(cell, TileType.BossOrigin);
	if (!inBounds || (isSetup && !isSpawnTile) || (!isSetup && isBlocked)) return DragStatus.Blocked;
	const tab = state.tabData[state.currentTab]!;
	for (const [dollId, pos] of Object.entries(tab.dollPositions)) {
		if (pos.x === tileX && pos.y === tileY && dollId !== id) return DragStatus.Swap;
	}
	for (const summon of tab.summonPositions) {
		if (summon.x === tileX && summon.y === tileY && summon.id !== id && summon.mapId !== instanceId) return DragStatus.Swap;
	}
	return DragStatus.Valid;
}

function AddDollToMap(drag: DragState): void {
	if (drag.status === DragStatus.Discard) {
		removeDollOrSummon(drag.id, drag.instanceId);
	} else if (drag.status === DragStatus.Swap) {
		const swapDoll = getObjectAtWorld(drag.currentTileX, drag.currentTileY);
		swapPositions(drag.id, drag.instanceId, drag.currentTileX, drag.currentTileY, swapDoll);
	} else if (drag.status === DragStatus.Valid) {
		if (drag.instanceId) {
			placeSummon(drag.id, drag.instanceId, drag.currentTileX, drag.currentTileY);
		} else {
			placeDoll(drag.id, drag.currentTileX, drag.currentTileY);
		}
	}
}

function updateDragInfo(clientX: number, clientY: number): void {
	if (drag.isActive === false) return;

	const world = screenToWorld(clientX, clientY);
	setDrag(
		produce((d) => {
			d.screenX = clientX;
			d.screenY = clientY;
			d.currentTileX = world.tileX;
			d.currentTileY = world.tileY;
			d.status = getDragStatus(world.tileX, world.tileY, drag.id, drag.instanceId);
		})
	);
}

function getObjectAtWorld(tileX: number, tileY: number): Omit<DragState, "screenX" | "screenY" | "isActive" | "status"> | null {
	const tab = state.tabData[state.currentTab]!;
	for (const [dollId, position] of Object.entries(tab.dollPositions)) {
		if (position.x === tileX && position.y === tileY) {
			return {
				id: dollId,
				instanceId: null,
				currentTileX: position.x,
				currentTileY: position.y,
			};
		}
	}
	for (const position of tab.summonPositions) {
		if (position.x === tileX && position.y === tileY) {
			return {
				id: position.id,
				instanceId: position.mapId,
				currentTileX: position.x,
				currentTileY: position.y,
			};
		}
	}
	return null;
}

// ─── Resize ────────────────────────────────────────────────────────────────

function bindResize(): void {
	window.addEventListener("resize", () => fitToWindow());
	// Re-check dpr changes (browser zoom, moving window between displays)
	window.matchMedia(`(resolution: ${dpr}dppx)`).addEventListener("change", () => fitToWindow());
	fitToWindow();
}

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

// ─── Export Element ────────────────────────────────────────────────────────────────

export default function ArenaCanvas() {
	onMount(() => {
		ctx = canvasEl.getContext("2d")!;
		bindResize();
		loop();
	});

	const isSetupTab = () => activeTab() === "setup" || state.currentTab === 0;
	const isActionTab = () => activeTab() === "actions" && state.currentTab > 0;
	const isDragActive = () => drag.isActive === true;

	return (
		<div>
			<div
				class="flex flex-1 touch-none"
				onWheel={handleWheel}
				onPointerDown={handlePointerDown}
				onPointerMove={handlePointerMove}
				onPointerUp={handlePointerUp}>
				<canvas ref={canvasEl} />
				{/* Coords overlay */}
				<div class="pointer-events-none absolute bottom-6 left-1/2 -translate-x-1/2 rounded-3xl bg-black/80 px-4 py-1.5 font-mono text-xs text-lime-400">
					{coords() || "00,00"}
				</div>
				<div
					class={`pointer-events-auto absolute top-1/2 right-6 flex -translate-y-1/2 touch-none flex-col items-center justify-center gap-2 rounded-2xl border-3 border-dashed border-[#7f1d1d] bg-[rgba(127,29,29,0.55)] p-6 backdrop-blur-sm select-none ${discardHover() ? "opacity-40" : "opacity-100"} ${isDragActive() ? "" : "pointer-events-none hidden"}`}
					onPointerEnter={handleDiscardEnter}
					onPointerLeave={handleDiscardLeave}>
					<div class="h-10 w-10">
						<Discard />
					</div>
					<span class="text-center text-lg leading-tight font-bold text-[#f87171]">Remove</span>
				</div>
			</div>
			<div class="absolute top-3.75 bottom-3.75 left-3.75 z-10 flex">
				<Modal width="w-96">
					<div class="flex gap-1 px-3 pb-1.75">
						<button
							onClick={() => {
								setActiveTab("setup");
							}}
							class={`flex h-13 flex-1 items-center justify-center gap-1 rounded-t-sm border-b-4 px-1 pt-3 pb-2 text-2xl font-bold transition-all ${
								isSetupTab()
									? "border-[#F0AF16] bg-[#384B53] text-[#EFEFEF] shadow-xl/20"
									: "border-[#8F9094] bg-[#A8A9AE] text-[#384B53] hover:border-[#606164]"
							}`}>
							<span>Setup</span>
						</button>
						<button
							onClick={() => {
								setActiveTab("actions");
							}}
							class={`flex h-13 flex-1 items-center justify-center gap-1 rounded-t-sm border-b-4 px-1 pt-3 pb-2 text-2xl font-bold transition-all ${
								isActionTab()
									? "border-[#F0AF16] bg-[#384B53] text-[#EFEFEF] shadow-xl/20"
									: "border-[#8F9094] bg-[#A8A9AE] text-[#384B53] hover:border-[#606164]"
							} ${state.currentTab === 0 ? "cursor-not-allowed opacity-50" : ""}`}>
							<span>Doll Actions</span>
						</button>
					</div>
					<SetupSidebar active={isSetupTab()} />
					<ActionSidebar active={isActionTab()} />
				</Modal>
			</div>
		</div>
	);
}
