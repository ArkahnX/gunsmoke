import { onMount } from "solid-js";
import {
	editorTool,
	setEditorTool,
	boundaryDir,
	setBoundaryDir,
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
	hasCover,
	inMapBounds,
	gridKey,
} from "../store";
import { TILE_SIZE, MAP_SIZE, CANVAS_SIZE, SCALE, E_PAD } from "../types/constants";
import { drawMapTilesOnArena } from "../canvas/draw";
import { editorSerialize, editorDeserialize, saveEditorMap, loadEditorMap, editorClearAll, editorResetLayout } from "../canvas/editorMap";
import type { EditorTool } from "../types";

let canvasEl!: HTMLCanvasElement;
let ctx: CanvasRenderingContext2D;
let painting = false;

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

function applyTool(c: number, r: number, erase: boolean) {
	if (!inMapBounds(c, r)) return;
	const dir = boundaryDir();
	if (erase) {
		const cell = mapGrid[gridKey(c, r)];
		if (!cell) return;
		if (cell.cover === "boss" && cell.bossOrigin) {
			const [oc, or] = cell.bossOrigin;
			for (let dr = 0; dr < 3; dr++)
				for (let dc = 0; dc < 3; dc++) {
					const bk = gridKey(oc + dc, or + dr);
					if (mapGrid[bk]) {
						mapGrid[bk]!.cover = null;
						mapGrid[bk]!.bossOrigin = null;
					}
				}
		} else if (cell.cover) {
			cell.cover = null;
		} else if (cell.bndH || cell.bndV) {
			cell.bndH = false;
			cell.bndV = false;
		} else {
			cell.spawn = false;
		}
		editorRender();
		return;
	}
	const tool = editorTool();
	if (tool === "boss") {
		if (c + 2 >= MAP_SIZE || r + 2 >= MAP_SIZE) return;
		for (let dr = 0; dr < 3; dr++) for (let dc = 0; dc < 3; dc++) if (hasCover(c + dc, r + dr)) return;
		for (let dr = 0; dr < 3; dr++)
			for (let dc = 0; dc < 3; dc++) {
				const cell = getCell(c + dc, r + dr);
				cell.cover = "boss";
				cell.bossOrigin = [c, r];
				cell.spawn = false;
				cell.bndH = false;
				cell.bndV = false;
			}
	} else if (tool === "hcov" || tool === "fcov") {
		const cell = getCell(c, r);
		cell.cover = tool;
		cell.spawn = false;
		cell.bndH = false;
		cell.bndV = false;
		cell.bossOrigin = null;
	} else if (tool === "spawn") {
		if (!hasCover(c, r)) getCell(c, r).spawn = true;
	} else if (tool === "hbnd") {
		if (dir === "h") {
			if (!inMapBounds(c, r + 1) || hasCover(c, r) || hasCover(c, r + 1)) return;
			getCell(c, r).bndH = true;
		} else {
			if (!inMapBounds(c + 1, r) || hasCover(c, r) || hasCover(c + 1, r)) return;
			getCell(c, r).bndV = true;
		}
	} else if (tool === "erase") {
		applyTool(c, r, true);
		return;
	}
	editorRender();
}

const TOOL_BUTTONS: { tool: EditorTool; label: string; color: string; border: string }[] = [
	{ tool: "spawn", label: "Spawn", color: "#0d2060", border: "#3060cc" },
	{ tool: "hbnd", label: "Half boundary", color: "#2a2010", border: "#6a5020" },
	{ tool: "hcov", label: "Half cover", color: "#1e3018", border: "#3a5830" },
	{ tool: "fcov", label: "Full cover", color: "#2a1c0c", border: "#6a4020" },
	{ tool: "boss", label: "Boss (3×3)", color: "#300a0a", border: "#882020" },
	{ tool: "erase", label: "Erase", color: "#1a1a1a", border: "#333" },
];

export default function EditorView() {
	onMount(() => {
		canvasEl.width = CANVAS_SIZE * SCALE;
		canvasEl.height = CANVAS_SIZE * SCALE;
		ctx = canvasEl.getContext("2d")!;
		loadEditorMap();
		editorRender();

		canvasEl.addEventListener("mousedown", (e) => {
			e.preventDefault();
			painting = true;
			const h = editorHit(e);
			applyTool(h.c, h.r, e.button === 2);
		});
		canvasEl.addEventListener("mousemove", (e) => {
			const pos = editorHit(e);
			if (pos.c < 0 || pos.r < 0) return;
			setEditorCoords(`${String(pos.r).padStart(2, "0")},${String(pos.c).padStart(2, "0")}`);
			if (!painting) return;
			applyTool(pos.c, pos.r, e.button === 2);
		});
		canvasEl.addEventListener("mouseup", () => {
			painting = false;
			saveEditorMap();
		});
		canvasEl.addEventListener("mouseleave", () => {
			painting = false;
		});
		canvasEl.addEventListener("contextmenu", (e) => e.preventDefault());
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
					<span class="etl text-[#445566]">Boundary:</span>
					<select
						value={boundaryDir()}
						onChange={(e) => setBoundaryDir(e.currentTarget.value as "h" | "v")}
						class="rounded border border-[#1e2730] bg-[#0c1014] px-1.5 py-0.5 text-[#6a7e8e]">
						<option value="h">Horizontal</option>
						<option value="v">Vertical</option>
					</select>

					<div class="mx-0.5 h-[18px] w-px bg-[#1e2730]" />
					{[
						{
							label: "Reset",
							onClick: () => {
								editorResetLayout();
								editorRender();
							},
						},
						{
							label: "Clear",
							onClick: () => {
								editorClearAll();
								editorRender();
							},
						},
					].map(({ label, onClick }) => (
						<button
							onClick={onClick}
							class="cursor-pointer rounded border border-[#1e2730] bg-[#0c1014] px-2 py-1 text-[#6a7e8e] hover:border-[#3a2020] hover:text-[#cc5040]">
							{label}
						</button>
					))}

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
				<canvas ref={canvasEl} style="display:block;cursor:crosshair;" />
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
