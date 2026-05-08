import { onMount } from "solid-js";
import {
	editorTool,
	setEditorTool,
	editorStatus,
	setEditorStatus,
	editorCoords,
	setEditorCoords,
	editorIoMode,
	setEditorIoMode,
	editorIoText,
	setEditorIoText,
	showEditorIo,
	setShowEditorIo,
	mapGrid,
	getCell,
	inMapBounds,
	hasCover,
	setCell,
	unsetBoss,
	isTileType,
} from "../store";
import { TILE_SIZE, CANVAS_SIZE, SCALE, E_PAD } from "../types/constants";
import { drawMapTilesOnArena } from "../canvas/draw";
import {
	saveEditorMap,
	loadEditorMap,
	editorClearAll,
	editorResetLayout,
	editingMap,
	loadMap,
	mapNames,
	editorSerialize,
	editorDeserialize,
} from "../canvas/editorMap";
import { TileType, type EditorTool } from "../types";
import { Select } from "@thisbeyond/solid-select";

let canvasEl!: HTMLCanvasElement;
let ctx: CanvasRenderingContext2D;
let painting = false;
const lastPaint = { x: -1, y: -1 };

export function editorRender() {
	if (!ctx) return;
	ctx.clearRect(0, 0, CANVAS_SIZE * SCALE, CANVAS_SIZE * SCALE);
	ctx.save();
	ctx.scale(SCALE, SCALE);
	drawMapTilesOnArena(ctx, null, -1);
	ctx.restore();
}

function editorHit(e: MouseEvent): { c: number; r: number } {
	const rect = canvasEl.getBoundingClientRect();
	const sx = (e.clientX - rect.left) * (CANVAS_SIZE / rect.width);
	const sy = (e.clientY - rect.top) * (CANVAS_SIZE / rect.height);
	return { c: Math.floor((sx - E_PAD) / TILE_SIZE), r: Math.floor((sy - E_PAD) / TILE_SIZE) };
}

function applyTool(c: number, r: number) {
	if (!inMapBounds(c, r)) return;
	const tool = editorTool();
	if (tool === "boss") {
		if (c + 1 >= mapGrid.size || r + 1 >= mapGrid.size) return;
		if (c - 1 < 0 || r - 1 < 0) return;
		for (let dr = -1; dr < 2; dr++) for (let dc = -1; dc < 2; dc++) if (hasCover(c + dc, r + dr)) return;
		unsetBoss();
		for (let dr = -1; dr < 2; dr++) {
			for (let dc = -1; dc < 2; dc++) {
				setCell(c + dc, r + dr, TileType.BossCover);
			}
		}
		setCell(c, r, TileType.BossOrigin);
	} else if (tool === "hcov") {
		setCell(c, r, TileType.HalfCover);
	} else if (tool === "fcov") {
		setCell(c, r, TileType.FullCover);
	} else if (tool === "spawn") {
		if (!hasCover(c, r)) setCell(c, r, TileType.Spawn, true);
	} else if (tool === "hbnd_h") {
		if (!inMapBounds(c, r + 1) || hasCover(c, r) || hasCover(c, r + 1)) return;
		setCell(c, r, TileType.HBoundary, true);
		setCell(c, r + 1, TileType.HBoundary, true);
	} else if (tool === "hbnd_v") {
		if (!inMapBounds(c + 1, r) || hasCover(c, r) || hasCover(c + 1, r)) return;
		setCell(c, r, TileType.VBoundary, true);
		setCell(c + 1, r, TileType.VBoundary, true);
	} else if (tool === "erase") {
		const cell = getCell(c, r);
		if (isTileType(cell, TileType.BossCover) || isTileType(cell, TileType.BossOrigin)) {
			unsetBoss();
		} else {
			setCell(c, r, TileType.Empty);
		}
	}
	editorRender();
}

const TOOL_BUTTONS: { tool: EditorTool; label: string; color: string; border: string }[] = [
	{ tool: "spawn", label: "Spawn", color: "#0d2060", border: "#3060cc" },
	{ tool: "hbnd_h", label: "H-Boundary", color: "#2a2010", border: "#6a5020" },
	{ tool: "hbnd_v", label: "V-Boundary", color: "#2a1a10", border: "#6a3a20" },
	{ tool: "hcov", label: "Half cover", color: "#1e3018", border: "#3a5830" },
	{ tool: "fcov", label: "Full cover", color: "#2a1c0c", border: "#6a4020" },
	{ tool: "boss", label: "Boss (3×3)", color: "#300a0a", border: "#882020" },
	{ tool: "erase", label: "Erase", color: "#1a1a1a", border: "#333" },
];

function handlePointerDown(e: PointerEvent) {
	e.preventDefault();
	painting = true;
	const h = editorHit(e);
	applyTool(h.c, h.r);
	lastPaint.x = h.c;
	lastPaint.y = h.r;
}
function handlePointerMove(e: PointerEvent) {
	const pos = editorHit(e);
	if (pos.c < 0 || pos.r < 0) return;
	setEditorCoords(`${String(pos.r).padStart(2, "0")},${String(pos.c).padStart(2, "0")}`);
	if (!painting || (lastPaint.x === pos.c && lastPaint.y === pos.r)) return;
	applyTool(pos.c, pos.r);
	lastPaint.x = pos.c;
	lastPaint.y = pos.r;
}
function handlePointerUp(e: PointerEvent) {
	painting = false;
	lastPaint.x = -1;
	lastPaint.y = -1;
}

export default function EditorView() {
	onMount(() => {
		canvasEl.width = CANVAS_SIZE * SCALE;
		canvasEl.height = CANVAS_SIZE * SCALE;
		ctx = canvasEl.getContext("2d")!;
		loadEditorMap();
		editorRender();
	});

	const handleDoIO = () => {
		if (editorIoMode() === "export") {
			navigator.clipboard.writeText(editorIoText()).catch(() => {});
			setEditorStatus("Copied to clipboard");
		} else {
			try {
				editorDeserialize(editorIoText());
				setShowEditorIo(false);
				setEditorStatus("Map imported successfully");
				saveEditorMap();
				editorRender();
			} catch (e: any) {
				setEditorStatus("Import error: " + e.message);
			}
		}
	};

	return (
		<div class="flex h-full flex-col gap-3 overflow-auto bg-zinc-950 p-3">
			{/* Toolbar */}
			<div class={`flex-wrap gap-1 rounded-sm bg-[#CFCED2] p-1 text-sm font-bold text-[#325563] shadow-sm shadow-black/50`}>
				<div class="flex flex-row items-center gap-1.5 border-2 border-[#B1AFB3] p-1">
					<Select
						class="custom"
						options={mapNames()}
						onChange={(value) => {
							loadMap(value);
							editorRender();
						}}
						initialValue={editingMap()}
					/>
					<div class="mx-0.5 h-[18px] w-px bg-[#1e2730]" />
					<span class="etl whitespace-nowrap">{editorCoords()}</span>
					<div class="mx-0.5 h-[18px] w-px bg-[#1e2730]" />
					<span class="etl">Tool:</span>

					{TOOL_BUTTONS.map(({ tool, label, color, border }) => (
						<button
							onClick={() => setEditorTool(tool)}
							class={`flex cursor-pointer items-center gap-1 rounded border px-2 py-1 whitespace-nowrap transition-colors ${
								editorTool() === tool
									? "border-[#2060cc] bg-[#1C2A32] text-[#4a9aff]"
									: "border-[#1e2730] bg-[#1C2A32] text-[#6a7e8e] hover:border-[#2e4050] hover:text-[#9ab0c0]"
							}`}>
							<span
								class="h-[11px] w-[11px] flex-shrink-0 rounded-[2px]"
								style={{ background: color, border: `1px solid ${border}` }}
							/>
							{label}
						</button>
					))}

					<div class="mx-0.5 h-[18px] w-px bg-[#1e2730]" />
					<button
						onClick={() => {
							editorResetLayout();
							editorRender();
						}}
						class="cursor-pointer rounded border border-[#1e2730] bg-[#0c1014] px-2 py-1 text-[#6a7e8e] hover:border-[#3a2020] hover:text-[#cc5040]">
						Reset
					</button>
					<button
						onClick={() => {
							editorClearAll();
							editorRender();
						}}
						class="cursor-pointer rounded border border-[#1e2730] bg-[#0c1014] px-2 py-1 text-[#6a7e8e] hover:border-[#3a2020] hover:text-[#cc5040]">
						Clear
					</button>

					<div class="mx-0.5 h-[18px] w-px bg-[#1e2730]" />
					<button
						onClick={() => {
							setEditorIoMode("export");
							setEditorIoText(editorSerialize());
							setShowEditorIo(true);
						}}
						class="cursor-pointer rounded border border-[#1e2730] bg-[#0c1014] px-2 py-1 text-[#6a7e8e] hover:border-[#3a2020] hover:text-[#cc5040]">
						Export JSON
					</button>
					<button
						onClick={() => {
							setEditorIoMode("import");
							setEditorIoText("");
							setShowEditorIo(true);
							setEditorStatus("Paste your JSON map data and click Load map");
						}}
						class="cursor-pointer rounded border border-[#1e2730] bg-[#0c1014] px-2 py-1 text-[#6a7e8e] hover:border-[#3a2020] hover:text-[#cc5040]">
						Import JSON
					</button>
				</div>
			</div>

			{/* Canvas */}
			<div class="flex-1 overflow-auto rounded-md" style="line-height:0">
				<canvas
					ref={canvasEl}
					style="display:block;cursor:crosshair;"
					onPointerDown={handlePointerDown}
					onPointerMove={handlePointerMove}
					onPointerUp={handlePointerUp}
					onPointerLeave={handlePointerUp}
				/>
			</div>

			<p class="mt-1 pl-0.5 text-[#2a3a4a]">{editorStatus()}</p>

			{/* IO area */}
			{showEditorIo() && (
				<div class="mt-2 flex-shrink-0 rounded-md border border-[#1e2730] bg-[#13181f] p-2">
					<textarea
						value={editorIoText()}
						onInput={(e) => setEditorIoText(e.currentTarget.value)}
						spellcheck={false}
						class="h-[120px] w-full resize-y rounded border border-[#1e2730] bg-[#0c1014] p-1.5 font-mono text-[11px] text-[#6a9a7a]"
					/>
					<div class="mt-1.5 flex gap-1.5">
						<button
							onClick={handleDoIO}
							class="cursor-pointer rounded border border-[#1e2730] bg-[#0c1014] px-2 py-1 text-[#6a7e8e] hover:border-[#3a2020] hover:text-[#cc5040]">
							{editorIoMode() === "export" ? "Copy to clipboard" : "Load map"}
						</button>
						<button
							onClick={() => setShowEditorIo(false)}
							class="cursor-pointer rounded border border-[#1e2730] bg-[#0c1014] px-2 py-1 text-[#6a7e8e] hover:border-[#3a2020] hover:text-[#cc5040]">
							Close
						</button>
					</div>
				</div>
			)}
		</div>
	);
}
