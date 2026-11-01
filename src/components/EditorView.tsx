import { createEffect, createMemo, createSignal, For, JSX, on, onCleanup, onMount, Show } from "solid-js";
import { E_PAD, MAP_SLOT_COUNT, MAX_MAP_SIZE, MIN_MAP_SIZE, TILE_SIZE } from "../types/constants";
import { drawMapTilesOnArena } from "../canvas/draw";
import {
	builtInMaps,
	clearSlot,
	copyFrom,
	editingSlot,
	exportJson,
	findMap,
	mapNameProblem,
	newBlank,
	parseMapJson,
	saveSlot,
	setEditingSlot,
	slotLabel,
	slots,
	timelineSlot,
	uniqueMapName,
} from "../canvas/editorMap";
import { MapGrid, TileType, type EditorTool } from "../types";
import Dropdown from "./Dropdown";
import Modal from "./modals/Modal";
import ModalHeader from "./modals/ModalHeader";
import ConfirmModal from "./modals/ConfirmModal";
import {
	fillGrid,
	getCell,
	gridKey,
	hasCover,
	inMapBounds,
	isTileType,
	mapGrid,
	ResizeAnchor,
	resizeMap,
	setCell,
	setPriority,
	unsetBoss,
} from "../store/mapGrid";
import { state } from "../store/appState";

const HINT = "Left-click / drag to place · Right-click a spawn to set its priority, anything else to erase · Scroll or pinch to zoom";

const [tool, setTool] = createSignal<EditorTool>("spawn");
const [status, setStatus] = createSignal(HINT);
const [coords, setCoords] = createSignal("");
/** Bumped after every edit: `mapGrid` is a plain object, so this is what makes the sidebar follow it */
const [revision, setRevision] = createSignal(0);
/** The spawn whose priority is being picked from the right-click popup, and where to show it */
const [rankPopup, setRankPopup] = createSignal<{ index: number; x: number; y: number } | null>(null);

let canvasEl: HTMLCanvasElement | undefined;
let ctx: CanvasRenderingContext2D | undefined;
let painting: EditorTool | null = null;
/** Set when a stroke changed the map, so it's saved once the stroke ends */
let dirty = false;
const lastPaint = { x: -1, y: -1 };

/** The editor's camera: the world point at the canvas centre, and CSS pixels per world unit (1 = 32px tiles) */
const view = { x: 0, y: 0, scale: 1 };
const MIN_ZOOM = 0.15;
const MAX_ZOOM = 6;
let dpr = 1;
/** Set when a map is opened, so the view fits it once the canvas has a size */
let needsFit = true;

/** The drawn map plus a little padding, in world units */
function logicalSize() {
	return { w: mapGrid.width * TILE_SIZE + 2 * E_PAD, h: mapGrid.height * TILE_SIZE + 2 * E_PAD };
}

/** Zooms so the whole map fits the canvas, centred. */
function fitView() {
	if (!canvasEl?.clientWidth || !canvasEl.clientHeight) return;
	const { w, h } = logicalSize();
	view.scale = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.min(canvasEl.clientWidth / w, canvasEl.clientHeight / h)));
	view.x = (mapGrid.width * TILE_SIZE) / 2;
	view.y = (mapGrid.height * TILE_SIZE) / 2;
	needsFit = false;
}

/** Keeps the zoom in range and some of the map on screen. */
function clampView() {
	view.scale = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, view.scale));
	view.x = Math.min(mapGrid.width * TILE_SIZE, Math.max(0, view.x));
	view.y = Math.min(mapGrid.height * TILE_SIZE, Math.max(0, view.y));
}

/** Matches the canvas buffer to its CSS size (times the device pixel ratio, so it stays sharp). */
function sizeCanvas() {
	if (!canvasEl) return;
	dpr = window.devicePixelRatio || 1;
	const width = Math.round(canvasEl.clientWidth * dpr);
	const height = Math.round(canvasEl.clientHeight * dpr);
	if (canvasEl.width !== width || canvasEl.height !== height) {
		canvasEl.width = width;
		canvasEl.height = height;
	}
}

export function editorRender() {
	if (!ctx || !canvasEl) return;
	sizeCanvas();
	if (needsFit) fitView();
	ctx.setTransform(1, 0, 0, 1, 0, 0);
	ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);
	const s = view.scale * dpr;
	ctx.setTransform(s, 0, 0, s, canvasEl.width / 2 - view.x * s, canvasEl.height / 2 - view.y * s);
	drawMapTilesOnArena(ctx, null, -1);
}

/** Client (CSS) coordinates to world units */
function toWorld(clientX: number, clientY: number) {
	if (!canvasEl) return { x: -1, y: -1 };
	const rect = canvasEl.getBoundingClientRect();
	return {
		x: (clientX - rect.left - rect.width / 2) / view.scale + view.x,
		y: (clientY - rect.top - rect.height / 2) / view.scale + view.y,
	};
}

/** Zooms by `factor`, keeping the world point under (clientX, clientY) in place. */
function zoomAt(clientX: number, clientY: number, factor: number) {
	const before = toWorld(clientX, clientY);
	view.scale = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, view.scale * factor));
	const after = toWorld(clientX, clientY);
	view.x += before.x - after.x;
	view.y += before.y - after.y;
	clampView();
	editorRender();
}

/** Zooms about the canvas centre (the sidebar's buttons). */
function zoomCentre(factor: number) {
	if (!canvasEl) return;
	const rect = canvasEl.getBoundingClientRect();
	zoomAt(rect.left + rect.width / 2, rect.top + rect.height / 2, factor);
}

function panBy(dx: number, dy: number) {
	view.x -= dx / view.scale;
	view.y -= dy / view.scale;
	clampView();
	editorRender();
}

/** Saves the edited map into its slot (and the timeline's copy, when it's the same map). */
function commit() {
	const slot = editingSlot();
	if (slot === null) return;
	saveSlot(slot, mapGrid);
	setRevision((r) => r + 1);
}

function editorHit(e: MouseEvent): { c: number; r: number } {
	const world = toWorld(e.clientX, e.clientY);
	return { c: Math.floor(world.x / TILE_SIZE), r: Math.floor(world.y / TILE_SIZE) };
}

function snapshot() {
	return mapGrid.tiles.join() + "|" + mapGrid.priority.join();
}

function applyTool(c: number, r: number, active: EditorTool) {
	if (!inMapBounds(c, r)) return;
	const before = snapshot();
	if (active === "boss") {
		if (c + 1 >= mapGrid.width || r + 1 >= mapGrid.height) return;
		if (c - 1 < 0 || r - 1 < 0) return;
		for (let dr = -1; dr < 2; dr++) for (let dc = -1; dc < 2; dc++) if (hasCover(c + dc, r + dr)) return;
		unsetBoss();
		for (let dr = -1; dr < 2; dr++) {
			for (let dc = -1; dc < 2; dc++) {
				setCell(c + dc, r + dr, TileType.BossCover);
			}
		}
		setCell(c, r, TileType.BossOrigin);
	} else if (active === "hcov") {
		setCell(c, r, TileType.HalfCover);
	} else if (active === "fcov") {
		setCell(c, r, TileType.FullCover);
	} else if (active === "spawn") {
		if (!hasCover(c, r)) setCell(c, r, TileType.Spawn, true);
	} else if (active === "hbnd_h") {
		if (!inMapBounds(c, r + 1) || hasCover(c, r) || hasCover(c, r + 1)) return;
		setCell(c, r, TileType.HBoundary, true);
		setCell(c, r + 1, TileType.HBoundary, true);
	} else if (active === "hbnd_v") {
		if (!inMapBounds(c + 1, r) || hasCover(c, r) || hasCover(c + 1, r)) return;
		setCell(c, r, TileType.VBoundary, true);
		setCell(c + 1, r, TileType.VBoundary, true);
	} else if (active === "priority") {
		// a numbered spawn loses its number (the rest move up); an unnumbered one goes last
		const index = gridKey(c, r);
		if (!isTileType(getCell(c, r), TileType.Spawn)) return;
		setPriority(index, mapGrid.priority.includes(index) ? null : mapGrid.priority.length + 1);
	} else if (active === "erase") {
		const cell = getCell(c, r);
		if (isTileType(cell, TileType.BossCover) || isTileType(cell, TileType.BossOrigin)) {
			unsetBoss();
		} else {
			setCell(c, r, TileType.Empty);
		}
	}
	if (snapshot() !== before) dirty = true;
	editorRender();
}

const TOOL_BUTTONS: { tool: EditorTool; label: string; color: string; border: string }[] = [
	{ tool: "spawn", label: "Spawn", color: "#0d2060", border: "#3060cc" },
	{ tool: "priority", label: "Priority", color: "#4888ff", border: "#a8c4ff" },
	{ tool: "hbnd_h", label: "H-Boundary", color: "#2a2010", border: "#6a5020" },
	{ tool: "hbnd_v", label: "V-Boundary", color: "#2a1a10", border: "#6a3a20" },
	{ tool: "hcov", label: "Half cover", color: "#1e3018", border: "#3a5830" },
	{ tool: "fcov", label: "Full cover", color: "#2a1c0c", border: "#6a4020" },
	{ tool: "boss", label: "Boss (3×3)", color: "#300a0a", border: "#882020" },
	{ tool: "erase", label: "Erase", color: "#1a1a1a", border: "#777" },
	{ tool: "zoom", label: "Pan / Zoom", color: "#3a4246", border: "#C9C8CE" },
];

/** Where each pointer touching the canvas was last seen */
const pointers = new Map<number, { x: number; y: number }>();
/** Dragging moves the view instead of painting (Pan / Zoom tool, middle button, or the finger left after a pinch) */
let panning = false;
/** A touch waits to see whether a second finger turns it into a pinch before it paints */
let pendingTouch: { c: number; r: number; tool: EditorTool } | null = null;

function pinch() {
	const [a, b] = [...pointers.values()];
	return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, distance: Math.hypot(a.x - b.x, a.y - b.y) };
}

function handlePointerDown(e: PointerEvent) {
	e.preventDefault();
	pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
	canvasEl?.setPointerCapture(e.pointerId);
	if (pointers.size === 2) {
		// a second finger turns the gesture into a pinch: keep what was painted, but stop painting
		pendingTouch = null;
		finishStroke();
		panning = false;
		return;
	}
	if (pointers.size > 2) return;
	if (e.button === 1 || (e.button === 0 && tool() === "zoom")) {
		panning = true;
		return;
	}
	const h = editorHit(e);
	if (!inMapBounds(h.c, h.r)) return;
	if (e.button === 2) {
		if (isTileType(getCell(h.c, h.r), TileType.Spawn)) {
			setRankPopup({ index: gridKey(h.c, h.r), x: e.clientX, y: e.clientY });
			return;
		}
		startStroke(h.c, h.r, "erase");
	} else if (e.button === 0) {
		if (e.pointerType === "touch") {
			pendingTouch = { c: h.c, r: h.r, tool: tool() };
			return;
		}
		// priorities are set one click at a time; dragging would renumber every spawn it crosses
		if (tool() === "priority") {
			applyTool(h.c, h.r, "priority");
			finishStroke();
			return;
		}
		startStroke(h.c, h.r, tool());
	}
}
function startStroke(c: number, r: number, active: EditorTool) {
	painting = active;
	applyTool(c, r, active);
	lastPaint.x = c;
	lastPaint.y = r;
}
function handlePointerMove(e: PointerEvent) {
	const previous = pointers.get(e.pointerId);
	if (previous && pointers.size === 2) {
		const before = pinch();
		pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
		const after = pinch();
		if (before.distance > 0) zoomAt(after.x, after.y, after.distance / before.distance);
		panBy(after.x - before.x, after.y - before.y);
		return;
	}
	if (previous) pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
	if (previous && panning) {
		panBy(e.clientX - previous.x, e.clientY - previous.y);
		return;
	}
	const pos = editorHit(e);
	if (!inMapBounds(pos.c, pos.r)) return;
	setCoords(`${String(pos.r).padStart(2, "0")},${String(pos.c).padStart(2, "0")}`);
	// a touch that slides onto another tile is a stroke (a priority touch only counts where it lifts)
	if (pendingTouch && pendingTouch.tool !== "priority" && (pendingTouch.c !== pos.c || pendingTouch.r !== pos.r)) {
		const { c, r, tool: active } = pendingTouch;
		pendingTouch = null;
		startStroke(c, r, active);
	}
	if (!painting || (lastPaint.x === pos.c && lastPaint.y === pos.r)) return;
	applyTool(pos.c, pos.r, painting);
	lastPaint.x = pos.c;
	lastPaint.y = pos.r;
}
function handlePointerUp(e: PointerEvent) {
	pointers.delete(e.pointerId);
	if (pendingTouch) {
		// a tap
		const { c, r, tool: active } = pendingTouch;
		pendingTouch = null;
		applyTool(c, r, active);
	}
	// the finger left after a pinch pans rather than paints
	if (pointers.size === 1) panning = true;
	if (pointers.size === 0) panning = false;
	finishStroke();
}
function handleWheel(e: WheelEvent) {
	e.preventDefault();
	// trackpad pinches arrive as wheel events with small deltas, so the zoom follows the delta's size
	zoomAt(e.clientX, e.clientY, Math.exp(-Math.max(-100, Math.min(100, e.deltaY)) * 0.002));
}
function finishStroke() {
	painting = null;
	lastPaint.x = -1;
	lastPaint.y = -1;
	if (!dirty) return;
	dirty = false;
	commit();
}

/** Opens the slot's map on the canvas, or goes back to the slot picker when the slot is empty. */
function openSlot(index: number | null) {
	const map = index === null ? null : slots()[index];
	if (index !== null && !map) {
		setEditingSlot(null);
		return;
	}
	if (map) fillGrid(map);
	needsFit = true;
	setRevision((r) => r + 1);
	setStatus(HINT);
	editorRender();
}

export default function EditorView() {
	createEffect(on(editingSlot, openSlot));
	onCleanup(() => {
		finishStroke();
		ctx = undefined;
		canvasEl = undefined;
		// the arena shows the timeline's map again
		const map = findMap(state.map);
		if (map) fillGrid(map);
	});

	return (
		<div class="flex h-full gap-3 overflow-hidden bg-zinc-950 p-3.75">
			<Show when={editingSlot() !== null} fallback={<SlotPicker />}>
				<div class="flex">
					<Modal width="w-(--sidebar-width)">
						<EditorSidebar />
					</Modal>
				</div>
				<EditorCanvas />
				<RankPopup />
			</Show>
		</div>
	);
}

function EditorCanvas() {
	// eslint-disable-next-line no-unassigned-vars -- assigned by the ref
	let el!: HTMLCanvasElement;
	onMount(() => {
		canvasEl = el;
		ctx = el.getContext("2d") ?? undefined;
		// the buffer follows the canvas's size, which changes with the window
		const observer = new ResizeObserver(() => {
			editorRender();
		});
		observer.observe(el);
		// added directly so preventDefault can stop the page from scrolling
		el.addEventListener("wheel", handleWheel, { passive: false });
		onCleanup(() => {
			observer.disconnect();
			el.removeEventListener("wheel", handleWheel);
			pointers.clear();
			panning = false;
			pendingTouch = null;
		});
		needsFit = true;
		editorRender();
	});
	return (
		<div class="relative min-w-0 flex-1 overflow-hidden rounded-sm">
			<canvas
				ref={el}
				class={`absolute inset-0 block h-full w-full touch-none ${tool() === "zoom" ? "cursor-grab" : "cursor-crosshair"}`}
				onPointerDown={handlePointerDown}
				onPointerMove={handlePointerMove}
				onPointerUp={handlePointerUp}
				onPointerCancel={handlePointerUp}
				onPointerLeave={() => {
					setCoords("");
				}}
				onContextMenu={(e) => {
					e.preventDefault();
				}}
			/>
			<div class="absolute top-3 right-3 flex gap-1.5">
				<SmallButton
					onClick={() => {
						zoomCentre(1 / 1.25);
					}}>
					−
				</SmallButton>
				<SmallButton
					onClick={() => {
						needsFit = true;
						editorRender();
					}}>
					Fit
				</SmallButton>
				<SmallButton
					onClick={() => {
						zoomCentre(1.25);
					}}>
					+
				</SmallButton>
			</div>
			<div class="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-3xl bg-black/80 px-4 py-1.5 font-mono text-xs leading-normal text-lime-400">
				{coords() || "--,--"}
			</div>
		</div>
	);
}

/** The right-click popup that moves a spawn to a chosen priority. */
function RankPopup() {
	const ranked = () => {
		const popup = rankPopup();
		return popup ? mapGrid.priority.indexOf(popup.index) + 1 : 0;
	};
	// an unnumbered spawn can also take the next number after the last one
	const count = () => mapGrid.priority.length + (ranked() ? 0 : 1);
	const pick = (rank: number | null) => {
		const popup = rankPopup();
		setRankPopup(null);
		if (!popup) return;
		setPriority(popup.index, rank);
		editorRender();
		commit();
	};
	return (
		<Show when={rankPopup()}>
			{(popup) => (
				<div
					class="fixed inset-0 z-40"
					onPointerDown={() => setRankPopup(null)}
					onContextMenu={(e) => {
						// on Windows this fires when the right-click that opened the popup is released, so it mustn't close it
						e.preventDefault();
					}}>
					<div
						class="gf-card absolute flex w-56 flex-col gap-2 text-sm"
						style={{
							left: `${Math.min(popup().x, window.innerWidth - 240)}px`,
							top: `${Math.min(popup().y, window.innerHeight - 200)}px`,
						}}
						onPointerDown={(e) => {
							e.stopPropagation();
						}}>
						<div class="font-bold">Spawn priority</div>
						<div class="grid grid-cols-6 gap-1">
							<For each={Array.from({ length: count() }, (_, i) => i + 1)}>
								{(rank) => (
									<button
										class={`h-7 cursor-pointer rounded-sm font-bold ${rank === ranked() ? "bg-[#F0AF16] text-[#1C2A32]" : "bg-[#384B53] text-[#EFEFEF] hover:bg-[#52575a]"}`}
										onClick={() => {
											pick(rank);
										}}>
										{rank}
									</button>
								)}
							</For>
						</div>
						<Show when={ranked()}>
							<SmallButton
								color="red"
								onClick={() => {
									pick(null);
								}}>
								Remove number
							</SmallButton>
						</Show>
					</div>
				</div>
			)}
		</Show>
	);
}

// ---- Shared bits ----

function SectionHeader(props: { children: JSX.Element }) {
	return (
		<div class="flex h-9 shrink-0 items-center self-stretch bg-[#384B53] px-3 font-bold tracking-wide text-[#ECECEC]">
			{props.children}
		</div>
	);
}

function SmallButton(props: {
	onClick: () => void;
	children: JSX.Element;
	color?: "dark" | "red" | "light";
	disabled?: boolean;
	class?: string;
}) {
	const colors = () =>
		props.color === "red"
			? "bg-[#944040] text-[#EFEFEF]"
			: props.color === "light"
				? "bg-[#C9C8CE] text-[#1C2A32]"
				: "bg-[#1C2A32] text-[#EFEFEF]";
	return (
		<button
			type="button"
			onClick={() => {
				props.onClick();
			}}
			disabled={props.disabled}
			class={`${colors()} ${props.class ?? ""} flex h-8 items-center justify-center rounded-sm px-3 text-sm font-bold whitespace-nowrap shadow-sm shadow-black/50 ${props.disabled ? "cursor-default opacity-50" : "cursor-pointer outline-2 outline-transparent transition duration-250 hover:outline-white hover:duration-0"}`}>
			{props.children}
		</button>
	);
}

function NumberInput(props: { value: number; onInput: (value: number) => void; label: string }) {
	return (
		<label class="flex items-center gap-1.5">
			<span>{props.label}</span>
			<input
				type="number"
				min={MIN_MAP_SIZE}
				max={MAX_MAP_SIZE}
				value={props.value}
				onInput={(e) => {
					props.onInput(e.currentTarget.valueAsNumber);
				}}
				class="input w-16 grow-0"
			/>
		</label>
	);
}

function sizeProblem(width: number, height: number): string | null {
	const ok = (n: number) => Number.isInteger(n) && n >= MIN_MAP_SIZE && n <= MAX_MAP_SIZE;
	return ok(width) && ok(height) ? null : `Width and height must be from ${MIN_MAP_SIZE} to ${MAX_MAP_SIZE}`;
}

function spawnCount(map: MapGrid) {
	return map.tiles.filter((tile) => isTileType(tile, TileType.Spawn)).length;
}

function copyText(text: string) {
	navigator.clipboard.writeText(text).then(
		() => setStatus("Copied to clipboard"),
		() => setStatus("Couldn't copy to the clipboard; select the text and copy it instead")
	);
}

// ---- Slot picker ----

function SlotPicker() {
	return (
		<div class="flex flex-1 items-start justify-center overflow-y-auto">
			<Modal width="w-180">
				<ModalHeader title="Map Editor" />
				<div class="flex flex-col gap-2 px-3 pb-3 text-[#1C2A32]">
					<SectionHeader>Choose a slot to edit</SectionHeader>
					<div class="px-1 text-sm font-bold text-[#384B53]">
						Custom maps are saved in your browser. You can export a timeline with a custom map.
					</div>
					<For each={Array.from({ length: MAP_SLOT_COUNT }, (_, i) => i)}>{(index) => <SlotCard index={index} />}</For>
				</div>
			</Modal>
		</div>
	);
}

function SlotCard(props: { index: number }) {
	const map = () => slots()[props.index];
	const [creating, setCreating] = createSignal(false);
	const [renaming, setRenaming] = createSignal(false);
	const [name, setName] = createSignal("");
	const [error, setError] = createSignal("");
	const [confirmClear, setConfirmClear] = createSignal(false);

	const rename = () => {
		const current = map();
		if (!current) return;
		const problem = mapNameProblem(name(), props.index);
		if (problem) {
			setError(problem);
			return;
		}
		saveSlot(props.index, { ...current, name: name().trim() });
		setRenaming(false);
		setError("");
	};

	return (
		<div class="gf-card flex flex-col gap-2">
			<Show
				when={map()}
				fallback={
					<>
						<div class="flex items-center gap-3">
							<span class="font-bold">Slot {props.index + 1}</span>
							<span class="flex-1 text-[#9AA3A8] italic">Empty</span>
							<Show when={!creating()}>
								<SmallButton color="light" onClick={() => setCreating(true)}>
									New map
								</SmallButton>
							</Show>
						</div>
						<Show when={creating()}>
							<NewMapForm index={props.index} onCancel={() => setCreating(false)} />
						</Show>
					</>
				}>
				{(current) => (
					<>
						<div class="flex items-center gap-3">
							<span class="font-bold">Slot {props.index + 1}</span>
							<div class="flex min-w-0 flex-1 flex-col">
								<span class="truncate text-lg font-bold">{current().name}</span>
								<span class="text-xs text-[#9AA3A8]">
									{current().width}×{current().height} · {spawnCount(current())} spawns, {current().priority.length}{" "}
									numbered
									<Show when={timelineSlot() === props.index}> · used by this timeline</Show>
								</span>
							</div>
							<SmallButton color="light" onClick={() => setEditingSlot(props.index)}>
								Edit
							</SmallButton>
							<SmallButton
								onClick={() => {
									setName(current().name);
									setError("");
									setRenaming(!renaming());
								}}>
								Rename
							</SmallButton>
							<SmallButton color="red" onClick={() => setConfirmClear(true)}>
								Clear
							</SmallButton>
						</div>
						<Show when={renaming()}>
							<div class="flex items-center gap-2">
								<input
									class="input"
									value={name()}
									maxLength={40}
									onInput={(e) => setName(e.currentTarget.value)}
									onKeyDown={(e) => {
										if (e.key === "Enter") rename();
									}}
								/>
								<SmallButton color="light" onClick={rename}>
									Save
								</SmallButton>
								<SmallButton onClick={() => setRenaming(false)}>Cancel</SmallButton>
							</div>
						</Show>
						<ConfirmModal
							mount={document.querySelector("#body") ?? document.body}
							title="Clear slot"
							content={`Delete "${current().name}" from slot ${props.index + 1}?`}
							isActive={confirmClear}
							setActive={setConfirmClear}
							onClick={() => {
								clearSlot(props.index);
							}}
						/>
					</>
				)}
			</Show>
			<Show when={error()}>
				<div class="text-sm text-[#f87171]">{error()}</div>
			</Show>
		</div>
	);
}

function NewMapForm(props: { index: number; onCancel: () => void }) {
	const sources = createMemo(() => [
		...builtInMaps().map((map) => ({ label: map.name, map })),
		...slots().flatMap((map, i) => (map ? [{ label: slotLabel(i, map), map }] : [])),
	]);
	const [mode, setMode] = createSignal<"blank" | "copy">("blank");
	const [name, setName] = createSignal(uniqueMapName("Custom Map"));
	const [width, setWidth] = createSignal(15);
	const [height, setHeight] = createSignal(15);
	const [source, setSource] = createSignal(sources()[0].label);
	const [error, setError] = createSignal("");

	const sourceMap = () => sources().find((s) => s.label === source())?.map;
	const pickMode = (next: "blank" | "copy") => {
		setMode(next);
		setError("");
		const from = sourceMap();
		setName(uniqueMapName(next === "copy" && from ? `${from.name} (Copy)` : "Custom Map"));
	};
	const create = () => {
		const problem = mapNameProblem(name(), props.index) ?? (mode() === "blank" ? sizeProblem(width(), height()) : null);
		if (problem) {
			setError(problem);
			return;
		}
		const from = sourceMap();
		if (mode() === "copy" && !from) return;
		const map = mode() === "copy" && from ? copyFrom(from, name()) : newBlank(name(), width(), height());
		saveSlot(props.index, map);
		setEditingSlot(props.index);
	};

	return (
		<div class="flex flex-col gap-2 border-t border-[#384B53] pt-2 text-sm">
			<div class="flex gap-1">
				<For each={["blank", "copy"] as const}>
					{(option) => (
						<button
							type="button"
							class={`h-8 flex-1 cursor-pointer rounded-t-sm border-b-4 font-bold ${mode() === option ? "border-[#F0AF16] bg-[#384B53] text-[#EFEFEF]" : "border-[#8F9094] bg-[#A8A9AE] text-[#384B53]"}`}
							onClick={() => {
								pickMode(option);
							}}>
							{option === "blank" ? "Blank" : "Copy from"}
						</button>
					)}
				</For>
			</div>
			<Show when={mode() === "copy"}>
				<Dropdown
					options={sources().map((s) => s.label)}
					value={source()}
					onChange={(value) => {
						setSource(value);
						const from = sourceMap();
						if (from) setName(uniqueMapName(`${from.name} (Copy)`));
					}}
				/>
			</Show>
			<label class="flex items-center gap-2">
				<span>Name</span>
				<input class="input" value={name()} maxLength={40} onInput={(e) => setName(e.currentTarget.value)} />
			</label>
			<Show when={mode() === "blank"}>
				<div class="flex items-center gap-4">
					<NumberInput label="Width" value={width()} onInput={setWidth} />
					<NumberInput label="Height" value={height()} onInput={setHeight} />
				</div>
			</Show>
			<Show when={error()}>
				<div class="text-[#f87171]">{error()}</div>
			</Show>
			<div class="flex justify-end gap-2">
				<SmallButton onClick={props.onCancel}>Cancel</SmallButton>
				<SmallButton color="light" onClick={create}>
					Create
				</SmallButton>
			</div>
		</div>
	);
}

// ---- Editor sidebar ----

function EditorSidebar() {
	const slot = () => editingSlot() ?? 0;
	// read through revision() so these follow edits to mapGrid
	const info = createMemo(() => {
		revision();
		return {
			name: mapGrid.name,
			width: mapGrid.width,
			height: mapGrid.height,
			spawns: spawnCount(mapGrid),
			numbered: mapGrid.priority.length,
		};
	});

	const [name, setName] = createSignal("");
	const [nameError, setNameError] = createSignal("");
	const [width, setWidth] = createSignal(0);
	const [height, setHeight] = createSignal(0);
	const [anchor, setAnchor] = createSignal<ResizeAnchor>({ x: 1, y: 1 });
	const [sizeError, setSizeError] = createSignal("");
	const [showExport, setShowExport] = createSignal(false);
	const [importText, setImportText] = createSignal("");
	const [importError, setImportError] = createSignal("");
	const [pendingImport, setPendingImport] = createSignal<MapGrid | null>(null);
	const [confirmImport, setConfirmImport] = createSignal(false);
	const [confirmClearPriority, setConfirmClearPriority] = createSignal(false);
	const exported = createMemo(() => {
		revision();
		return exportJson();
	});

	// the fields start from the open map, and again whenever another slot or import replaces it
	createEffect(
		on(
			() => [editingSlot(), info().name, info().width, info().height] as const,
			() => {
				setName(info().name);
				setWidth(info().width);
				setHeight(info().height);
			}
		)
	);

	const rename = () => {
		if (name().trim() === mapGrid.name) return;
		const problem = mapNameProblem(name(), slot());
		setNameError(problem ?? "");
		if (problem) return;
		mapGrid.name = name().trim();
		commit();
	};

	const resize = () => {
		const problem = sizeProblem(width(), height());
		setSizeError(problem ?? "");
		if (problem) return;
		resizeMap(width(), height(), anchor());
		editorRender();
		commit();
	};

	const readImport = () => {
		try {
			const map = parseMapJson(importText());
			map.name = uniqueMapName(map.name, slots(), slot());
			setImportError("");
			setPendingImport(map);
			setConfirmImport(true);
		} catch (e) {
			const message = e instanceof Error ? e.message : String(e);
			setImportError(message);
			setStatus(`Import failed: ${message}`);
		}
	};
	const applyImport = () => {
		const map = pendingImport();
		if (!map) return;
		saveSlot(slot(), map);
		fillGrid(map);
		needsFit = true;
		editorRender();
		setRevision((r) => r + 1);
		setImportText("");
		setPendingImport(null);
		setStatus(`Imported "${map.name}"`);
	};

	return (
		<div class="flex min-h-0 flex-1 flex-col">
			<ModalHeader title="Map Editor" />
			<div class="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-3 pb-2 text-sm text-[#1C2A32] *:shrink-0">
				<div class="gf-card flex items-center gap-2">
					<div class="flex min-w-0 flex-1 flex-col">
						<span class="truncate text-lg font-bold">{info().name}</span>
						<span class="text-xs text-[#9AA3A8]">
							Slot {slot() + 1} · {info().width}×{info().height}
							<Show when={timelineSlot() === slot()}> · used by this timeline</Show>
						</span>
					</div>
					<SmallButton color="light" onClick={() => setEditingSlot(null)}>
						Change slot
					</SmallButton>
				</div>

				<SectionHeader>Tools</SectionHeader>
				<div class="grid grid-cols-2 gap-1.5">
					<For each={TOOL_BUTTONS}>
						{({ tool: option, label, color, border }) => (
							<button
								type="button"
								onClick={() => setTool(option)}
								class={`flex h-9 cursor-pointer items-center gap-2 rounded-sm border-l-4 px-2 font-bold whitespace-nowrap shadow-sm shadow-black/50 ${
									tool() === option
										? "border-[#F0AF16] bg-[#384B53] text-[#EFEFEF]"
										: "border-transparent bg-[#1C2A32] text-[#C9C8CE] hover:text-[#EFEFEF]"
								}`}>
								<span class="h-3 w-3 shrink-0 rounded-xs" style={{ background: color, border: `1px solid ${border}` }} />
								{label}
							</button>
						)}
					</For>
				</div>

				<SectionHeader>Spawn priority</SectionHeader>
				<div class="px-1 font-bold text-[#384B53]">
					{info().numbered} of {info().spawns} spawns numbered. You can assign priority to spawn tiles with the priority tool.
					Left click to assign in order, or right click to assign a specific number.
				</div>
				<SmallButton color="red" disabled={info().numbered === 0} onClick={() => setConfirmClearPriority(true)} class="self-start">
					Clear priorities
				</SmallButton>
				<ConfirmModal
					mount={document.querySelector("#body") ?? document.body}
					title="Clear priorities"
					content="Remove the number from every spawn?"
					isActive={confirmClearPriority}
					setActive={setConfirmClearPriority}
					onClick={() => {
						mapGrid.priority.length = 0;
						editorRender();
						commit();
					}}
				/>

				<SectionHeader>Map options</SectionHeader>
				<label class="flex items-center gap-2 font-bold">
					<span>Name</span>
					<input
						class="input"
						value={name()}
						maxLength={40}
						onInput={(e) => setName(e.currentTarget.value)}
						onChange={rename}
						onKeyDown={(e) => {
							if (e.key === "Enter") rename();
						}}
					/>
				</label>
				<Show when={nameError()}>
					<div class="text-[#AE4749]">{nameError()}</div>
				</Show>

				<div class="flex items-center gap-3 font-bold">
					<div class="flex flex-col gap-1.5">
						<NumberInput label="Width" value={width()} onInput={setWidth} />
						<NumberInput label="Height" value={height()} onInput={setHeight} />
					</div>
					<div class="flex flex-col items-center gap-0.5">
						<div class="grid grid-cols-3 gap-0.5" title="Which side stays in place when the map grows or shrinks">
							<For each={[0, 1, 2] as const}>
								{(y) => (
									<For each={[0, 1, 2] as const}>
										{(x) => (
											<button
												type="button"
												aria-label={`Anchor ${["top", "middle", "bottom"][y]} ${["left", "centre", "right"][x]}`}
												class={`h-5 w-5 cursor-pointer rounded-xs ${anchor().x === x && anchor().y === y ? "bg-[#F0AF16]" : "bg-[#1C2A32] hover:bg-[#52575a]"}`}
												onClick={() => setAnchor({ x, y })}
											/>
										)}
									</For>
								)}
							</For>
						</div>
						<span class="text-xs">Anchor</span>
					</div>
					<SmallButton onClick={resize} disabled={width() === info().width && height() === info().height} class="ml-auto">
						Resize
					</SmallButton>
				</div>
				<Show when={sizeError()}>
					<div class="text-[#AE4749]">{sizeError()}</div>
				</Show>

				<div class="flex gap-2">
					<SmallButton onClick={() => setShowExport(!showExport())}>{showExport() ? "Hide export" : "Export JSON"}</SmallButton>
				</div>
				<Show when={showExport()}>
					<textarea
						readOnly
						value={exported()}
						onFocus={(e) => {
							e.currentTarget.select();
						}}
						spellcheck={false}
						class="h-32 min-h-20 resize-y rounded-sm bg-zinc-950 p-2 font-mono text-xs text-[#9ab0c0]"
					/>
					<SmallButton
						color="light"
						onClick={() => {
							copyText(exported());
						}}
						class="self-start">
						Copy
					</SmallButton>
				</Show>

				<textarea
					value={importText()}
					onInput={(e) => setImportText(e.currentTarget.value)}
					spellcheck={false}
					placeholder="Paste map JSON to import into this slot..."
					class="h-32 min-h-20 resize-y rounded-sm bg-zinc-950 p-2 font-mono text-xs text-[#9ab0c0]"
				/>
				<Show when={importError()}>
					<div class="text-[#AE4749]">Import error: {importError()}</div>
				</Show>
				<SmallButton onClick={readImport} disabled={!importText().trim()} class="self-start">
					Import into this slot
				</SmallButton>
				<ConfirmModal
					mount={document.querySelector("#body") ?? document.body}
					title="Replace map"
					content={`Replace "${info().name}" in slot ${slot() + 1} with "${pendingImport()?.name ?? ""}"?`}
					isActive={confirmImport}
					setActive={setConfirmImport}
					onClick={applyImport}
				/>
			</div>
			<div class="border-t-3 border-[#B5B5B6] px-3 pt-1.5 text-xs font-bold text-[#384B53]">{status()}</div>
		</div>
	);
}
