import { For, createEffect, createMemo, onCleanup, Show } from "solid-js";
import { trackStore } from "@solid-primitives/deep";
import { TILE_SIZE } from "../types/constants";
import { drawMapTilesOnArena } from "../canvas/draw";
import SmallDollChip from "./SmallDollChip";
import Fortification from "./icons/Fortification";
import Modal from "./modals/Modal";
import SquareDollChip from "./SquareDollChip";
import { TileType } from "../types";
import Borrow from "./icons/Borrow";
import Alert from "./icons/Alert";
import UnreleasedBadge from "./icons/UnreleasedBadge";
import { state } from "../store/appState";
import { imagesLoaded } from "../store/images";
import { gridKey, isTileType, mapGrid } from "../store/mapGrid";
import { rarityBorderColor, rarityGradientColor, renderAction } from "../store/effects";
import { sortDisplayEquippedKeys } from "../store/keys";
import {
	getBuffById,
	getCurrentSeason,
	getDollAvatarByKey,
	getDollChibiIconByWeapon,
	getEntitiesByIdBatch,
	getSelectedDoll,
	getWeaponByDollId,
	getWeaponById,
} from "../store/gameData";
import { getActionErrors, isRenderable } from "../store/validation";
import { Buffs } from "../../gfl2-data/buffs";
import { LocationKey } from "../types/issues";

const CANVAS_DISPLAY_PX = 430;

function renderTabCanvas(tabIndex: number): HTMLCanvasElement {
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
	for (let x = 0; x < mapGrid.width; x++) {
		for (let y = 0; y < mapGrid.height; y++) {
			const cell = isTileType(mapGrid.tiles[gridKey(x, y)], TileType.BossOrigin);
			if (cell) {
				if (x < bMinC) bMinC = x;
				if (x > bMaxC) bMaxC = x;
				if (y < bMinR) bMinR = y;
				if (y > bMaxR) bMaxR = y;
			}
		}
	}
	if (!isFinite(bMinC)) {
		bMinC = 0;
		bMaxC = mapGrid.width - 1;
		bMinR = 0;
		bMaxR = mapGrid.height - 1;
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
	const ctx = canvas.getContext("2d");
	if (!ctx) throw new Error("Could not get 2D canvas context");

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
	const labelW = Math.ceil(ctx.measureText(`Turn ${tabIndex}`).width) + 6;
	ctx.fillStyle = "rgba(0,0,0,0.65)";
	ctx.fillRect(12, 17, labelW, 20);
	ctx.fillStyle = "#2dd4bf";
	ctx.fillText(`Turn ${tabIndex}`, 40, 20);

	return canvas;
}

function TabCard(props: { tabIndex: number }) {
	const mountCanvas = (canvasWrap: HTMLDivElement) => {
		// redrawn whenever the timeline changes (e.g. fixes applied from the issues modal) or an image arrives, since drawing
		// reads them untracked; on the next frame, so a burst of changes draws once and a new map is loaded by then
		let frame = 0;
		createEffect(() => {
			trackStore(state);
			imagesLoaded();
			cancelAnimationFrame(frame);
			frame = requestAnimationFrame(() => {
				canvasWrap.replaceChildren(renderTabCanvas(props.tabIndex));
			});
		});
		onCleanup(() => {
			cancelAnimationFrame(frame);
		});
	};

	const actionOrder = createMemo(() => {
		const order = state.tabData[props.tabIndex]?.actionOrder ?? [];
		return getEntitiesByIdBatch(
			order.filter((_id, index) => isRenderable({ kind: LocationKey.ActionOrder, tab: props.tabIndex, index }))
		);
	});

	const hasActions = createMemo(() => {
		if (props.tabIndex === 0) return false;
		for (const sd of state.selectedDolls) {
			if (state.tabData[props.tabIndex].actions[sd.id]?.length) {
				return true;
			}
		}
		return false;
	});

	return (
		<Modal width="min-w-151 grow">
			{/* <div class="relative min-w-140 flex-1 overflow-hidden rounded-sm border-t-[6px] border-[#506A6C] bg-[#293438]"> */}
			<div class="flex flex-row gap-2">
				{/* Mini map canvas */}
				<div
					ref={mountCanvas}
					style={`width:${CANVAS_DISPLAY_PX}px;height:${CANVAS_DISPLAY_PX}px;flex-shrink:0;overflow:hidden;border-right:1px solid #3f3f46;`}
				/>
				{/* Actions list */}
				<div class="flex min-w-0 grow flex-col gap-1 overflow-y-auto">
					{hasActions() ? (
						<For each={actionOrder()}>
							{(entity) => {
								const actions = createMemo(() => state.tabData[props.tabIndex]?.actions[entity.id] ?? []);
								if (!actions().length) return null;
								return (
									<div class="flex flex-col items-start gap-1 rounded-xs border-b-2 bg-[#F4F4F6] p-1 shadow-sm shadow-black/30">
										<div class="flex flex-row items-center gap-1">
											<SquareDollChip target={entity} size="h-10 w-10" icon={false} name={false} />
											<div class="font-bold text-[#325563]">{entity.name}</div>
										</div>
										<div class="min-w-0 flex-1">
											<div class="flex flex-wrap gap-1">
												<For each={actions()}>
													{(a, index) => {
														const at = () => ({ tab: props.tabIndex, ownerId: entity.id, index: index() });
														const errors = createMemo(() => getActionErrors(at()));
														return (
															<span
																class={`rounded-sm ${errors().length ? "bg-[#AE4749]" : "bg-[#384B53]"} px-1 py-0.5 text-[13px] font-bold tracking-wide text-[#EFEFEF] shadow-sm shadow-black/50`}
																title={errors()
																	.map((e) => e.message)
																	.join("\n")}>
																<Show when={errors().length}>
																	<span class="mr-1 inline-block h-3 w-3 align-[-1px] text-[#F0AF16]">
																		<Alert />
																	</span>
																</Show>
																{renderAction(a, at())}
															</span>
														);
													}}
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
	return (
		<div class="flex h-full flex-col gap-3 overflow-auto bg-zinc-950 p-3">
			{/* Header */}
			<div class="grid grid-cols-2 gap-2">
				<For each={state.selectedDolls}>
					{(selectedDoll) => {
						const doll = getSelectedDoll(selectedDoll);
						const dollFortification = createMemo(() => selectedDoll.fortification || "—");
						const dollRemolding = createMemo(() => `Lv.${selectedDoll.remoldingLvl}`);
						const dollWeapon = createMemo(() =>
							// an unknown weapon (reported by validateSave) displays as the doll's signature weapon
							isRenderable({ kind: LocationKey.DollWeapon, dollId: doll.id })
								? getWeaponById(selectedDoll.gun)
								: getWeaponByDollId(doll.id)
						);
						const weaponChibi = createMemo(() => {
							return getDollChibiIconByWeapon(dollWeapon());
						});
						const dollKeys = createMemo(() => sortDisplayEquippedKeys(selectedDoll));
						return (
							<div class="flex flex-row items-center gap-2 rounded-sm border-t-4 border-[#3E5356] bg-[#2C373B] p-2 shadow-sm shadow-black/50">
								<SmallDollChip target={doll} />
								<div class="text-md flex w-12 flex-col items-center justify-center">
									<Show when={selectedDoll.borrow}>
										<div class="relative h-6 w-6">
											<Borrow />
										</div>
									</Show>
									<div class="relative h-12 w-12">
										<div class="absolute z-10">
											<Fortification />
										</div>
										<div class="absolute z-20 flex h-full w-full items-center justify-center pt-0.5 text-[18px] font-bold">
											{dollFortification()}
										</div>
									</div>
								</div>
								<div class="text-md relative flex h-12 w-12 flex-col items-center justify-start overflow-hidden rounded-full">
									<div class="h-8 w-8">
										<img src={doll.icons.remolding} />
									</div>
									<div
										class={`absolute bottom-0 flex h-full w-full items-end justify-center bg-linear-to-t from-black/50 via-black/20 to-transparent px-1 text-xs font-bold text-[#EFEFEF]`}>
										<div class="">{dollRemolding()}</div>
									</div>
								</div>
								<div class="relative flex h-17 w-32.5 flex-col items-center justify-center overflow-hidden rounded-sm bg-[#354346] px-1.5 py-1 shadow-sm shadow-black/50">
									<Show when={dollWeapon().dollId}>
										<div class="absolute bottom-1 left-2 z-10 h-8 w-8">
											<img src={weaponChibi()} class="relative h-full w-full object-cover" />
										</div>
									</Show>
									<div
										class={`absolute bottom-1 z-30 w-full text-right font-bold ${weaponChibi() === "" ? "pl-1.25" : "pl-9"} overflow-hidden pr-2 text-ellipsis whitespace-nowrap`}>
										{dollWeapon().name}
									</div>
									<img
										src={dollWeapon().icon}
										class={`relative z-20 h-full w-full border-b-3 ${rarityBorderColor(dollWeapon().rarity)} object-cover`}
									/>
									<Show when={dollWeapon().unreleased}>
										<UnreleasedBadge class="top-1 left-1 z-30 text-xs" />
									</Show>
									<div
										class={`absolute bottom-0 left-0 z-0 h-full w-full bg-linear-to-t ${rarityGradientColor(dollWeapon().rarity)} from-0% to-transparent to-75%`}></div>
								</div>
								<For each={dollKeys()}>
									{(key) => {
										if (key) {
											const keyDollIcon = getDollAvatarByKey(key);
											return (
												<div class="inset-shadow-2xl relative flex h-17 w-17 flex-col items-center justify-center">
													<div class="absolute z-10">
														<div class="relative w-20">
															<img src={key.icon} class="w-full object-cover object-top" />
														</div>
													</div>
													<Show when={key.unreleased}>
														<UnreleasedBadge />
													</Show>
													<Show when={key.number !== null}>
														<div class="absolute right-1.5 bottom-1.5 z-20 rounded-sm bg-[#2A3D46] px-1 text-sm font-bold text-[#EFEFEF]">
															{key.number}
														</div>
													</Show>
													{keyDollIcon && (
														<div class="absolute right-0 bottom-0.5 z-20 h-8 w-8 overflow-hidden rounded-full border-2 border-white bg-[#C9C8CE]">
															<div class="relative -top-1 -left-2.25 w-12">
																<img src={keyDollIcon} class="w-full object-cover object-top" />
															</div>
														</div>
													)}
												</div>
											);
										}
									}}
								</For>
							</div>
						);
					}}
				</For>
			</div>
			<div class="flex flex-row flex-wrap gap-2 min-[1860px]:grid min-[1860px]:grid-cols-3">
				{/* Dolls block */}
				<Modal width="min-w-151 grow">
					<div class="flex flex-col gap-2">
						<For each={state.buffs.filter((buffId) => isRenderable({ kind: LocationKey.Buff, buffId }))}>
							{(buffId) => {
								const season = getCurrentSeason();
								const buff = getBuffById(buffId);
								const isCore = buffId === season.buffId;
								const days = () => {
									if (buffId === season.buffId) {
										return "Effective this season";
									}
									if (season.dailyBuffIds[buffId]) {
										return "Available on days " + season.dailyBuffIds[buffId].join(", ");
									}
									return "Unavailable this gunsmoke season";
								};
								return (
									<div class="relative flex grow flex-row items-start gap-3 rounded-sm bg-[#F2EEF8] p-2.5 shadow-sm shadow-black/20">
										<div
											class={`relative flex h-15 w-15 shrink-0 ${isCore ? "bg-[#0D76A1]" : "bg-[#2D464E]"} rounded-sm`}>
											<img src={buff.icon} class="relative z-20 h-full w-full object-cover" />
										</div>
										<div class="flex grow flex-col gap-3 text-[#384B53]">
											<div class="flex grow flex-row gap-3 border-b-2 border-[#E0DDE7]">
												<div class="text-left font-bold text-black">{buff.name}</div>
												<div class="text-left">{days()}</div>
											</div>
											<div class="text-left">
												<Buffs id={buff.id} />
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
