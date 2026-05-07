import { createSignal, onMount } from "solid-js";
import { state, placeDoll, placeSummon, mapGrid, removeDollOrSummon, setCoords, coords } from "../store";
import { TILE_SIZE, MAP_BOUNDS, MIN_SCALE, MAX_SCALE, MAP_SIZE } from "../types/constants";
import { drawMapTilesOnArena, drawGhostOnCanvas } from "../canvas/draw";
import { createStore, produce } from "solid-js/store";
import { Camera, DragState } from "../types";
import Discard from "./icons/Discard";
import Modal from "./modals/Modal";
import SetupSidebar from "./SetupSidebar";
import ActionSidebar from "./ActionSidebar";


let canvasEl!: HTMLCanvasElement;
let ctx: CanvasRenderingContext2D;
let dpr: number = 1;

const camera: Camera = { x: MAP_BOUNDS.maxX / 2, y: MAP_BOUNDS.maxY / 2, scale: 2 };

const activePointers: Map<number, { x: number; y: number }> = new Map();

const [activeTab, setActiveTab] = createSignal("setup");

const [drag, setDrag] = createStore<DragState>({
	id: "",
	instanceId: "",
	screenX: -1,
	screenY: -1,
	currentTileX: -1,
	currentTileY: -1,
	isValid: false,
	isOverDiscard: false,
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
			const isOccupied = isDollAtTile(world.tileX, world.tileY, hit.id, hit.instanceId);
			const isValid = isValidMapPosition(world.tileX, world.tileY) && !isOccupied;
			setDrag(
				produce((d) => {
					d.id = hit.id;
					d.instanceId = hit.instanceId;
					d.screenX = e.clientX;
					d.screenY = e.clientY;
					d.currentTileX = hit.currentTileX;
					d.currentTileY = hit.currentTileY;
					d.isActive = true;
					d.isValid = isValid;
					d.isOverDiscard = false;
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
		const isOccupied = isDollAtTile(world.tileX, world.tileY, id, instanceId);
		const isValid = isValidMapPosition(world.tileX, world.tileY) && !isOccupied;
		setDrag(
			produce((d) => {
				d.id = id;
				d.instanceId = instanceId;
				d.screenX = e.clientX;
				d.screenY = e.clientY;
				d.currentTileX = world.tileX;
				d.currentTileY = world.tileY;
				d.isActive = true;
				d.isValid = isValid;
				d.isOverDiscard = false;
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
	setDrag(
		produce((d) => {
			d.isOverDiscard = true;
		})
	);
}

export function handleDiscardLeave(e: PointerEvent) {
	e.preventDefault();
	if (!drag.isActive) return;
	setDrag(
		produce((d) => {
			d.isOverDiscard = false;
		})
	);
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

export function isDragActive() {
	return drag.isActive;
}

export function isDiscardActive() {
	return drag.isOverDiscard;
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

function AddDollToMap(drag: DragState): void {
	const isOccupied = isDollAtTile(drag.currentTileX, drag.currentTileY, drag.id, drag.instanceId);
	const isValid = isValidMapPosition(drag.currentTileX, drag.currentTileY) && !isOccupied;

	if (drag.isOverDiscard) {
		removeDollOrSummon(drag.id, drag.instanceId);
	} else if (isValid) {
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
	const isOccupied = isDollAtTile(world.tileX, world.tileY, drag.id, drag.instanceId);
	const isValid = isValidMapPosition(world.tileX, world.tileY) && !isOccupied;
	setDrag(
		produce((d) => {
			d.screenX = clientX;
			d.screenY = clientY;
			d.currentTileX = world.tileX;
			d.currentTileY = world.tileY;
			d.isValid = isValid;
		})
	);
}

function getObjectAtWorld(
	tileX: number,
	tileY: number
): Omit<DragState, "screenX" | "screenY" | "isOverDiscard" | "isActive" | "isValid"> | null {
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
					class={`pointer-events-auto absolute top-1/2 right-6 flex -translate-y-1/2 touch-none flex-col items-center justify-center gap-2 rounded-2xl border-3 border-dashed border-[#7f1d1d] bg-[rgba(127,29,29,0.55)] p-6 backdrop-blur-sm select-none ${isDiscardActive() ? "opacity-40" : "opacity-100"} ${isDragActive() ? "" : "pointer-events-none hidden"}`}
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
