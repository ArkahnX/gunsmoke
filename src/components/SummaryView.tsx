import { onMount, For, createMemo, createSignal } from "solid-js";
import {
	state,
	allSummons,
	getDollInfoFromId,
	getFortificationFromId,
	renderAction,
	mapGrid,
	getSelectedDollAndSummonInfo,
	allDolls,
	getDollFromSummon,
	compress,
	setShowImportModal,
	updateSkillDisplay,
} from "../store";
import { TILE_SIZE, MAP_SIZE, SAVE_VERSION } from "../types/constants";
import { drawMapTilesOnArena, drawDollOnCanvas, drawSummonOnCanvas } from "../canvas/draw";
import type { DollData } from "../types";
import DollChip from "./DollChip";
import Button from "./buttons/Button";
import SmallDollChip from "./SmallDollChip";
import Fortification from "./icons/Fortification";
import Modal from "./modals/Modal";
import SquareDollChip from "./SquareDollChip";
import ContentModal from "./modals/ContentModal";

const CANVAS_DISPLAY_PX = 430;

function renderTabCanvas(tabIndex: number): HTMLCanvasElement {
	console.log("Rendering tab", tabIndex);
	const placedEntities: { x: number; y: number }[] = [];

	const placedDollPositions: { pos: { x: number; y: number }; doll: { id: string; fortification: number } }[] = [];

	state.selectedDolls.forEach((doll) => {
		const pos = state.tabData[tabIndex]?.dollPositions[doll.id] ?? { x: -1, y: -1 };
		if (pos.x === -1 || pos.y === -1) return;
		placedDollPositions.push({ pos, doll });
		placedEntities.push(pos);
	});

	for (const pos of state.tabData[tabIndex]?.summonPositions ?? []) {
		placedEntities.push(pos);
	}

	// Bounding box
	let bMinC = Infinity,
		bMaxC = -Infinity,
		bMinR = Infinity,
		bMaxR = -Infinity;
	for (const pos of placedEntities) {
		if (pos.x < bMinC) bMinC = pos.x;
		if (pos.x > bMaxC) bMaxC = pos.x;
		if (pos.y < bMinR) bMinR = pos.y;
		if (pos.y > bMaxR) bMaxR = pos.y;
	}
	for (const k in mapGrid) {
		const cell = mapGrid[k];
		if (!cell || cell.cover !== "boss") continue;
		const [tc, tr] = k.split(",").map(Number) as [number, number];
		if (tc < bMinC) bMinC = tc;
		if (tc > bMaxC) bMaxC = tc;
		if (tr < bMinR) bMinR = tr;
		if (tr > bMaxR) bMaxR = tr;
	}
	if (!isFinite(bMinC)) {
		bMinC = 0;
		bMaxC = MAP_SIZE - 1;
		bMinR = 0;
		bMaxR = MAP_SIZE - 1;
	}
	bMinC -= 1;
	bMaxC += 1;
	bMinR -= 1;
	bMaxR += 1;
	const spanC = bMaxC - bMinC + 1;
	const spanR = bMaxR - bMinR + 1;
	const span = Math.max(spanC, spanR, 9);
	const cCtr = (bMinC + bMaxC + 1) / 2;
	const rCtr = (bMinR + bMaxR + 1) / 2;

	const OUTPUT_SIZE = span * Math.ceil(429 / span);
	const tileSize = OUTPUT_SIZE / span;
	const sqC0 = cCtr - span / 2;
	const sqR0 = rCtr - span / 2;
	const tileC0 = Math.floor(sqC0);
	const tileR0 = Math.floor(sqR0);
	const subPxX = Math.round((sqC0 - tileC0) * tileSize);
	const subPxY = Math.round((sqR0 - tileR0) * tileSize);

	const canvas = document.createElement("canvas");
	canvas.width = OUTPUT_SIZE;
	canvas.height = OUTPUT_SIZE;
	canvas.style.cssText = `display:block;width:${OUTPUT_SIZE}px;height:${OUTPUT_SIZE}px;flex-shrink:0;`;
	const ctx = canvas.getContext("2d")!;

	ctx.save();
	ctx.translate(-subPxX, -subPxY);
	ctx.scale(tileSize / TILE_SIZE, tileSize / TILE_SIZE);
	ctx.translate(-tileC0 * TILE_SIZE, -tileR0 * TILE_SIZE);
	ctx.fillStyle = "#18181b";
	ctx.fillRect((tileC0 - 2) * TILE_SIZE, (tileR0 - 2) * TILE_SIZE, (span + 4) * TILE_SIZE, (span + 4) * TILE_SIZE);
	drawMapTilesOnArena(ctx, null, tabIndex);
	ctx.restore();

	ctx.font = `bold 16px Roboto, sans-serif`;
	ctx.textAlign = "center";
	ctx.textBaseline = "top";
	const labelW = Math.ceil(ctx.measureText("Turn " + tabIndex).width) + 6;
	ctx.fillStyle = "rgba(0,0,0,0.65)";
	ctx.fillRect(12, 17, labelW, 20);
	ctx.fillStyle = "#2dd4bf";
	ctx.fillText("Turn " + tabIndex, 40, 20);

	return canvas;
}

function TabCard(props: { tabIndex: number }) {
	let canvasWrapRef!: HTMLDivElement;

	onMount(() => {
		const canvas = renderTabCanvas(props.tabIndex);
		canvasWrapRef.appendChild(canvas);
	});

	const tabLabel = () => (props.tabIndex === 0 ? "Setup" : `Turn ${props.tabIndex}`);

	const actionOrder = createMemo(() => state.tabData[props.tabIndex]?.actionOrder ?? []);

	const hasActions = createMemo(() => {
		if (props.tabIndex === 0) return false;
		return state.selectedDolls.some((d) => (state.tabData[props.tabIndex]?.actions[d.id]?.length ?? 0) > 0);
	});

	return (
		<Modal width="min-w-140 grow">
			{/* <div class="relative min-w-140 flex-1 overflow-hidden rounded-sm border-t-[6px] border-[#506A6C] bg-[#293438]"> */}
			<div class="flex flex-row gap-2">
				{/* Mini map canvas */}
				<div
					ref={canvasWrapRef}
					style={`width:${CANVAS_DISPLAY_PX}px;height:${CANVAS_DISPLAY_PX}px;flex-shrink:0;overflow:hidden;border-right:1px solid #3f3f46;`}
				/>
				{/* Actions list */}
				<div class="flex min-w-0 grow flex-col gap-1 overflow-y-auto">
					{hasActions() ? (
						<For each={actionOrder()}>
							{(dollId) => {
								const actions = createMemo(() => state.tabData[props.tabIndex]?.actions[dollId] ?? []);
								if (!actions().length) return null;
								const doll = createMemo(() => getDollInfoFromId(dollId));
								const fort = createMemo(() => getFortificationFromId(dollId));
								return (
									<div class="flex flex-col items-start gap-1 rounded-xs border-b-2 bg-[#F4F4F6] p-1 shadow-sm shadow-black/30">
										<div class="flex flex-row items-center gap-1">
											<SquareDollChip
												target={doll()!}
												doll={getDollFromSummon(doll()!)}
												size="h-10 w-10"
												icon={false}
												name={false}
											/>
											<div class="font-bold text-[#325563]">{doll()?.name}</div>
										</div>
										<div class="min-w-0 flex-1">
											<div class="flex flex-wrap gap-1">
												<For each={actions()}>
													{(a) => (
														<span class="rounded-sm bg-[#384B53] px-1 py-0.5 text-[13px] font-bold tracking-wide text-[#EFEFEF] shadow-sm shadow-black/50">
															{renderAction(dollId, a)}
														</span>
													)}
												</For>
											</div>
										</div>
									</div>
								);
							}}
						</For>
					) : (
						<div class="pt-1 text-sm text-zinc-600">No actions recorded</div>
					)}
				</div>
			</div>
			{/* </div> */}
		</Modal>
	);
}

export default function SummaryView() {
	const exportAllTabs = async () => {
		const exportObj = { version: SAVE_VERSION, ...state };
		const str = await compress(JSON.stringify(exportObj));
		await navigator.clipboard.writeText(str);
		alert("✅ Exported all turns to clipboard!");
	};

	const [showSkillDesignModal, setShowSkillDesignModal] = createSignal(false);

	return (
		<div class="flex h-full flex-col gap-3 overflow-auto bg-zinc-950 p-3">
			<div class={`rounded-sm bg-[#CFCED2] p-1 shadow-sm shadow-black/50`}>
				{/* Header */}
				<div class="flex flex-row gap-1.5 border-2 border-[#B1AFB3] p-1">
					<Button onClick={exportAllTabs} color="dark" design="custom" content="Export Transcript" />
					<Button onClick={() => setShowImportModal(true)} color="dark" design="custom" content="Import Transcript" />
					<Button onClick={() => setShowSkillDesignModal(true)} color="dark" design="custom" content="Set Skill Display" />
					<ContentModal
						mount={document.querySelector("#body")!}
						width="w-90"
						title="Skill Display"
						isActive={showSkillDesignModal}
						setActive={setShowSkillDesignModal}>
						<ul class="flex flex-col gap-2 self-center">
							<li class="flex flex-row items-center gap-2">
								<Button
									onClick={() => {
										updateSkillDisplay(0);
										setShowSkillDesignModal(false);
									}}
									color="dark"
									design="custom"
									content="Style 1"
								/>
								<div
									class={`rounded-sm bg-[#384B53] px-1 py-0.5 text-[13px] font-bold tracking-wide text-[#EFEFEF] shadow-sm shadow-black/50 ${state.actionType === 0 ? "outline-2 outline-[#F26C1C]" : ""}`}>
									S1 / S2 / S3 / S4
								</div>
							</li>
							<li class="flex flex-row items-center gap-2">
								<Button
									onClick={() => {
										updateSkillDisplay(1);
										setShowSkillDesignModal(false);
									}}
									color="dark"
									design="custom"
									content="Style 2"
								/>
								<div
									class={`rounded-sm bg-[#384B53] px-1 py-0.5 text-[13px] font-bold tracking-wide text-[#EFEFEF] shadow-sm shadow-black/50 ${state.actionType === 1 ? "outline-2 outline-[#F26C1C]" : ""}`}>
									1 / 2 / 3 / 4
								</div>
							</li>
							<li class="flex flex-row items-center gap-2">
								<Button
									onClick={() => {
										updateSkillDisplay(2);
										setShowSkillDesignModal(false);
									}}
									color="dark"
									design="custom"
									content="Style 3"
								/>
								<div
									class={`rounded-sm bg-[#384B53] px-1 py-0.5 text-[13px] font-bold tracking-wide text-[#EFEFEF] shadow-sm shadow-black/50 ${state.actionType === 2 ? "outline-2 outline-[#F26C1C]" : ""}`}>
									BA / S1 / S2 / ULT
								</div>
							</li>
						</ul>
					</ContentModal>
				</div>
			</div>
			<div class="flex flex-wrap gap-2">
				{/* Dolls block */}
				<Modal width="w-138 grow">
					<div class="flex flex-col gap-1">
						<For each={state.selectedDolls}>
							{(doll) => {
								const dollInfo = createMemo(() => allDolls().find((d) => d.id === doll.id) as DollData);
								return (
									<div class="rounded-sm bg-[#E6E6E6] p-1 shadow-sm shadow-black/50">
										<div class="flex flex-row items-center gap-3 border-2 border-[#D7D7D7] p-1">
											<SmallDollChip target={dollInfo()} doll={dollInfo()} />
											<div class="relative h-12 w-12">
												<div class="absolute z-10">
													<Fortification />
												</div>
												<div class="absolute z-20 flex h-full w-full items-center justify-center text-[18px] font-bold">
													{doll.fortification || "—"}
												</div>
											</div>
										</div>
									</div>
								);
							}}
						</For>
					</div>
				</Modal>

				{/* Tab cards */}
				<For each={Array.from({ length: 8 }, (_, i) => i)}>{(i) => <TabCard tabIndex={i} />}</For>
			</div>
		</div>
	);
}
