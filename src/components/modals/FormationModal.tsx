import { createMemo, createSignal, For, Show } from "solid-js";
import Button from "../buttons/Button";
import SmallKey from "../icons/SmallKey";
import DynamicDollChip from "../DynamicDollChip";
import Fortification from "../icons/Fortification";
import Check from "../icons/Check";
import Borrow from "../icons/Borrow";
import UnreleasedBadge from "../icons/UnreleasedBadge";
import { tempSelectedDolls } from "../../store/appState";
import { setSelectedDoll, setShowFormationModal, setShowKeyModal, setShowWeaponModal } from "../../store/uiState";
import {
	changeBorrow,
	changeFortification,
	changeRemoldingLvl,
	dollHasLoadout,
	loadDollLoadout,
	saveDollLoadout,
	updateSelectedDolls,
} from "../../store/dollSelection";
import { displaySmallKeys } from "../../store/keys";
import { interactiveStyles, rarityBorderColor, rarityGradientColor } from "../../store/effects";
import { getDollChibiIconByWeapon, getSelectedDoll, getWeaponByDollId, getWeaponById } from "../../store/gameData";
import { isRenderable } from "../../store/validation";
import { LocationKey } from "../../types/issues";

export default function FormationModal() {
	// const selectedDollIds = createMemo(() => tempSelectedDolls.map((doll) => doll.id));
	// const setNum = (dollId: string, num: number) => {
	// 	setDollFortification((prev) => ({ ...prev, [dollId]: num }));
	// };
	// const weapon = allWeapons[10];

	const confirm = async () => {
		setShowFormationModal(false);
		await updateSelectedDolls();
	};
	return (
		<>
			<div class="relative flex flex-wrap items-center justify-start gap-4 px-10 py-8">
				<For each={tempSelectedDolls}>
					{(doll) => {
						const [savedLoadout, setSavedLoadout] = createSignal(false);
						const dollInfo = getSelectedDoll(doll);
						const dollFortification = createMemo(() => doll.fortification || "—");
						const dollRemolding = createMemo(() => "Lv." + String(doll.remoldingLvl));
						const dollWeapon = createMemo(() =>
							// an unknown weapon (reported by validateSave) displays as the doll's signature weapon
							isRenderable({ kind: LocationKey.DollWeapon, dollId: doll.id })
								? getWeaponById(doll.gun)
								: getWeaponByDollId(doll.id)
						);
						const weaponChibi = createMemo(() => {
							return getDollChibiIconByWeapon(dollWeapon());
						});
						const hasLoadout = createMemo(() => dollHasLoadout(doll.id));
						const keys = createMemo(() => displaySmallKeys(doll));
						return (
							<div class="flex items-center gap-3 bg-[#B6BAC6] p-2.5">
								<DynamicDollChip target={dollInfo} />
								<div class="flex flex-col gap-3">
									<div class="flex flex-row gap-3">
										<div
											onclick={() => {
												setSelectedDoll(doll);
												setShowKeyModal(true);
												setSavedLoadout(false);
											}}
											class={`${interactiveStyles(false)} text-md flex h-10 grow flex-row items-center justify-center gap-1 rounded-sm bg-[#354346] p-1 shadow-sm shadow-black/50`}>
											<For each={keys()}>
												{(key) =>
													typeof key === "string" ? (
														<div class="flex h-7 w-4 items-center justify-center">=</div>
													) : key ? (
														<div class="h-5 w-5">
															<SmallKey rarity={key.rarity} keyType={key.type} />
														</div>
													) : null
												}
											</For>
										</div>
										<div
											onClick={() => {
												changeBorrow(doll.id);
											}}
											class={`${interactiveStyles(doll.borrow)} text-md flex h-10 flex-row items-center justify-center gap-1 rounded-sm bg-[#354346] p-1 shadow-sm shadow-black/50`}>
											<div class={`${doll.borrow ? "opacity-100" : "opacity-20"} w-5`}>
												<Check />
											</div>
											<div class="w-6">
												<Borrow />
											</div>
										</div>
									</div>
									<div class="flex flex-row gap-3">
										<div class="text-md flex w-12 flex-col items-center justify-center rounded-sm bg-[#354346] shadow-sm shadow-black/50">
											<div class="relative h-12 w-12">
												<div class="absolute z-10">
													<Fortification />
												</div>
												<div class="absolute z-20 flex h-full w-full items-center justify-center pt-0.5 text-[18px] font-bold">
													{dollFortification()}
												</div>
											</div>
											<div class="flex flex-row gap-2 text-sm font-bold">
												<button
													class={`${interactiveStyles(false)} flex h-4 w-4 items-center justify-center rounded-sm`}
													onClick={() => {
														setSavedLoadout(false);
														changeFortification(doll.id, -1);
													}}>
													-
												</button>
												<button
													class={`${interactiveStyles(false)} flex h-4 w-4 items-center justify-center rounded-sm`}
													onClick={() => {
														setSavedLoadout(false);
														changeFortification(doll.id, 1);
													}}>
													+
												</button>
											</div>
										</div>
										<div class="text-md flex w-14 flex-col items-center justify-center rounded-sm bg-[#354346] px-1 pt-1 shadow-sm shadow-black/50">
											<div class="relative h-12 w-12 overflow-hidden rounded-full">
												<img src={dollInfo.icons.remolding} />
												<div
													class={`absolute top-0 right-0 bottom-0 left-0 flex items-end justify-center bg-linear-to-t from-black/50 via-black/20 to-transparent px-1 text-xs font-bold text-[#EFEFEF]`}>
													<div class="overflow-hidden overflow-ellipsis whitespace-nowrap">{dollRemolding()}</div>
												</div>
											</div>
											<div class="flex flex-row gap-2 text-sm font-bold">
												<button
													class={`${interactiveStyles(false)} flex h-4 w-4 items-center justify-center rounded-sm`}
													onClick={() => {
														setSavedLoadout(false);
														changeRemoldingLvl(doll.id, -1);
													}}>
													-
												</button>
												<button
													class={`${interactiveStyles(false)} flex h-4 w-4 items-center justify-center rounded-sm`}
													onClick={() => {
														setSavedLoadout(false);
														changeRemoldingLvl(doll.id, 1);
													}}>
													+
												</button>
											</div>
										</div>
										<div
											onclick={() => {
												setSelectedDoll(doll);
												setShowWeaponModal(true);
												setSavedLoadout(false);
											}}
											class={`${interactiveStyles(false)} relative h-17 w-31.5 flex-col items-center justify-center overflow-hidden rounded-sm bg-[#354346] px-1.5 py-1 shadow-sm shadow-black/50`}>
											<Show when={dollWeapon().dollId}>
												<div class="absolute bottom-1 left-2 z-10 h-8 w-8">
													<img src={weaponChibi()} class="relative h-full w-full object-cover" />
												</div>
											</Show>
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
										<div class="flex w-14 flex-col gap-3 text-sm font-bold tracking-wide">
											<button
												onClick={() => {
													setSavedLoadout(true);
													saveDollLoadout(doll.id);
												}}
												class={`${interactiveStyles(false)} rounded-sm bg-[#354346] px-2 py-1 shadow-sm shadow-black/50`}>
												{savedLoadout() ? "Saved" : "Save"}
											</button>
											<button
												onClick={() => {
													if (dollHasLoadout(doll.id)) {
														loadDollLoadout(doll.id);
													}
												}}
												class={`${hasLoadout() ? interactiveStyles(false) : "opacity-50"} rounded-sm bg-[#354346] px-2 py-1 shadow-sm shadow-black/50`}>
												Load
											</button>
										</div>
									</div>
								</div>
							</div>
						);
					}}
				</For>
				<div
					class={
						tempSelectedDolls.length % 2 === 1
							? "absolute right-10 bottom-8 flex justify-end gap-3"
							: "flex grow justify-end gap-3"
					}>
					<Button onClick={() => void confirm()} color="light" design="confirm" />
				</div>
			</div>
		</>
	);
}
