import { createMemo, createSignal, For, Show } from "solid-js";
import { getInfoFromId, selectedDoll, sortEquippedKeys, allKeys, interactiveStyles, setDollKey, setShowKeyModal } from "../../store";
import { CommonKey, DetailedKey, DollData, FixedKey } from "../../types";
import EmptyKey from "../icons/EmptyKey";
import Check from "../icons/Check";
import Button from "../buttons/Button";

export default function KeyModal() {
	const dollInfo = createMemo(() => getInfoFromId(selectedDoll()!.id) as DollData | null);
	if (!dollInfo()) return null;
	const selectedKeys = createMemo(() => sortEquippedKeys(selectedDoll()!.id, selectedDoll()!.keys));
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
	const visibleKeys = createMemo(() => {
		const isSel = (keyId: string) => {
			return selectedDoll()!.keys.includes(keyId);
		};
		return keyTypes[keyMapping[activeKeySlot()]].sort(
			(a, b) =>
				+isSel(b.id) - +isSel(a.id) ||
				(a.number || 0) - (b.number || 0) ||
				("dollName" in a && "dollName" in b && a.dollName.localeCompare(b.dollName)) ||
				a.name.localeCompare(b.name)
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
									onClick={() => setActiveKeySlot(index())}
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
					<div class="font-bold h-8 p-2 pl-4 flex shrink-0">{keyTitle()}</div>
					<div class="flex grow overflow-y-auto p-5 px-4 pt-2">
						<div class="flex flex-row flex-wrap items-start gap-3.5">
							<For each={visibleKeys()}>
								{(key) => {
									const isSel = () => {
										return selectedDoll()!.keys.includes(key.id);
									};
									const toggleKey = () => {
										const index = selectedDoll()!.keys.indexOf(key.id);
										if (index > -1) {
											setDollKey(selectedDoll()!.id, index, null);
										} else {
											setDollKey(selectedDoll()!.id, activeKeySlot(), key.id);
										}
									};
									return (
										<div
											onClick={toggleKey}
											class={`${interactiveStyles(isSel())} inset-shadow-2xl relative flex flex-col rounded-sm border-3 border-[#B2B1B6] bg-[#95999B] shadow-black/75`}>
											<Show when={isSel()}>
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
					<div class="flex justify-end p-2">
						<Button
							onClick={() => {
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
