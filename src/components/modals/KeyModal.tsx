import { createEffect, createMemo, createSignal, For, Show } from "solid-js";
import {
	getInfoFromId,
	selectedDoll,
	allKeys,
	interactiveStyles,
	setShowKeyModal,
	sortEquippedKeys,
	getPreSortedKeyInfo,
	setDollKeys,
	allEffects,
} from "../../store";
import { CommonKey, DetailedKey, DollData, FixedKey } from "../../types";
import EmptyKey from "../icons/EmptyKey";
import Check from "../icons/Check";
import Button from "../buttons/Button";
import { createStore } from "solid-js/store";
import Fuse from "fuse.js";

export default function KeyModal() {
	const dollInfo = createMemo(() => getInfoFromId(selectedDoll()!.id) as DollData | null);
	if (!dollInfo()) return null;
	const [sortedKeys, setSortedKeys] = createStore(sortEquippedKeys(selectedDoll()!.id, selectedDoll()!.keys));
	const selectedKeys = createMemo(() => getPreSortedKeyInfo(selectedDoll()!.id, sortedKeys));
	const keyMapping = ["Fixed Key", "Fixed Key", "Fixed Key", "Expansion Key", "Affinity Key", "Common Key", "Common Key", "Common Key"];

	const keyTypes: Record<string, (DetailedKey | FixedKey)[]> = {
		"Fixed Key": [],
		"Expansion Key": [],
		"Affinity Key": [...allKeys.affinity],
		"Common Key": [...allKeys.common],
	};
	keyTypes["Fixed Key"].push(...dollInfo()!.keys.filter((k) => k.type === "Fixed Key"));
	keyTypes["Expansion Key"].push(...dollInfo()!.keys.filter((k) => k.type === "Expansion Key"));

	const [activeKeySlot, setActiveKeySlot] = createSignal(0);
	const keyTitle = createMemo(() => selectedKeys()[activeKeySlot()]?.name ?? "");
	const keyDescription = createMemo(() => {
		const description = selectedKeys()[activeKeySlot()]?.description ?? "";
		return description.replace(/\{(e[0-9]+)\}/gi, (match, effectId) => allEffects.filter((s) => s.id === effectId)[0]?.name ?? match);
	});
	const [query, setQuery] = createSignal("");
	const visibleKeys = createMemo(() => {
		return keyTypes[keyMapping[activeKeySlot()]];
	});

	const filteredKeys = createMemo(() => {
		const isSel = (keyId: string) => {
			return sortedKeys.includes(keyId);
		};
		const fuse = new Fuse(visibleKeys(), {
			keys: ["name", "dollname"],
		});
		const results = fuse.search(query());
		return results.sort(
			(a, b) =>
				+isSel(b.item.id) - +isSel(a.item.id) ||
				(a.item.number || 0) - (b.item.number || 0) ||
				("dollName" in a.item && "dollName" in b.item && a.item.dollName.localeCompare(b.item.dollName)) ||
				a.item.name.localeCompare(b.item.name)
		);
	});

	return (
		<>
			<div class="flex max-h-180 flex-row px-10">
				<div class="flex w-30 shrink-0 flex-col items-stretch justify-center bg-[#2A3D46] py-5">
					<div class="flex justify-center pb-2">
						<img
							src={dollInfo()!.avatar}
							loading="lazy"
							class="h-15 w-15 rounded-full border-3 border-[#687177] bg-[#0D1C1C] object-cover"
						/>
					</div>
					<For each={selectedKeys()}>
						{(selectedKey, index) => {
							if (dollInfo()!.hasExpansionKey === false && index() === 3) return null;
							const isSel = () => activeKeySlot() === index();
							const selectedStyle = "border-[#F26C1C] bg-linear-to-r from-[#5B403E] to-transparent scale-107";
							const unselectedStyle =
								"cursor-pointer transition-discrete duration-175 hover:scale-107 border-transparent hover:border-white bg-linear-to-r from-transparent hover:from-[#515B61] to-transparent";
							return (
								<div
									onClick={() => {
										setQuery("");
										setActiveKeySlot(index());
									}}
									class={`flex justify-center border-l-4 py-2 ${isSel() ? selectedStyle : unselectedStyle}`}>
									<div class="h-15 w-15">
										<Show when={selectedKey} fallback={<EmptyKey color={isSel() ? "Light" : "Dark"} />}>
											<img src={selectedKey!.localImagePath} class="h-16 w-16 object-cover" />
										</Show>
									</div>
								</div>
							);
						}}
					</For>
				</div>
				<div class="flex w-70 grow flex-col">
					<div class="flex shrink flex-row flex-wrap gap-1 p-2 pl-4">
						<div class="flex font-bold">{keyTitle()}</div>
						<div class="" innerHTML={keyDescription()}></div>
					</div>
					<div class="flex grow overflow-y-auto p-5 px-4 pt-2">
						<div class="flex flex-row flex-wrap content-start items-start gap-3.5">
							<For each={visibleKeys()}>
								{(key) => {
									const isSel = () => {
										if (sortedKeys.includes(key.id)) {
											if (sortedKeys[activeKeySlot()] === key.id) {
												return true;
											} else {
												return null;
											}
										}
										return false;
									};
									const toggleKey = () => {
										const index = sortedKeys.indexOf(key.id);
										if (index > -1) {
											setSortedKeys(index, "");
										} else {
											setSortedKeys(activeKeySlot(), key.id);
										}
									};
									const [isVisible, setIsVisible] = createSignal(false);
									let index = createMemo(() => {
										let index = filteredKeys().findIndex((filteredKey) => key.id === filteredKey.item.id);
										setIsVisible(index > -1);
										return index > -1 ? index : 9999;
									});

									return (
										<div
											onClick={toggleKey}
											class={`${interactiveStyles(isSel())} inset-shadow-2xl relative flex flex-col rounded-sm border-3 border-[#B2B1B6] bg-[#95999B] shadow-black/75 ${isVisible() ? "" : "hidden"}`}
											style={{ order: index() }}>
											<Show when={isSel() !== false}>
												<div class="absolute top-1 right-1 z-20 h-7 w-7 shadow-sm shadow-black/20">
													<Check />
												</div>
											</Show>
											<div
												class={`${key.rarity === "Elite" ? "border-[#DF9E00]" : "border-[#7968BA]"} relative border-b-5`}>
												<img src={key.localImagePath} class="h-22 w-22 object-cover" />
												<Show when={key.number !== null}>
													<div class="absolute right-1 bottom-1 rounded-sm bg-[#2A3D46] px-1 text-xs font-bold text-[#EFEFEF]">
														{key.number}
													</div>
												</Show>
												{"dollAvatar" in key && (
													<div class="absolute right-1 bottom-2 z-20 h-8 w-8 overflow-hidden rounded-full border-2 border-white bg-[#C9C8CE]">
														<div class="relative -top-1 -left-2.5 w-12">
															<img src={key.dollAvatar} class="w-full object-cover object-top" />
														</div>
													</div>
												)}
											</div>
										</div>
									);
								}}
							</For>
						</div>
					</div>
					<div class="flex p-2">
						<div class="flex grow justify-center p-2">
							<input
								class="input"
								type="text"
								value={query()}
								onInput={(e) => setQuery(e.target.value)}
								placeholder="Filter..."
							/>
						</div>
						<Button
							onClick={() => {
								setDollKeys(selectedDoll()!.id, sortedKeys);
								setShowKeyModal(false);
							}}
							color="light"
							design="confirm"
						/>
					</div>
				</div>
			</div>
		</>
	);
}
