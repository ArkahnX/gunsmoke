import { createEffect, createMemo, createSignal, For, Show, on, onCleanup, onMount } from "solid-js";
import EmptyKey from "../icons/EmptyKey";
import Check from "../icons/Check";
import Lock from "../icons/Lock";
import ThumbsUp from "../icons/ThumbsUp";
import UnreleasedBadge from "../icons/UnreleasedBadge";
import Alert from "../icons/Alert";
import Button from "../buttons/Button";
import { createStore, unwrap } from "solid-js/store";
import Fuse from "fuse.js";
import {
	keyFocus,
	selectedDoll,
	setEffectModalEffects,
	setEffectModalPosition,
	setKeyFocus,
	setShowEffectModal,
	setShowKeyModal,
} from "../../store/uiState";
import { tempSelectedDolls } from "../../store/appState";
import { keySwapImpact } from "../../store/saveFixes";
import { keyName } from "../../store/validation";
import { getPreSortedKeyInfo, keyHolders, keyMapping, maxKeyHolders, sortEquippedKeys } from "../../store/keys";
import { getReferencedEffects, interactiveStyles, parseEffects, rarityBorderColor } from "../../store/effects";
import { setDollKeys } from "../../store/dollSelection";
import { combinedKeys, getDollAvatarByKey, getDollById, getKeyById, getSelectedDoll, hasExpansionKey } from "../../store/gameData";
import { KeyType, KeyTypeLabels } from "../../../gfl2-data/enums";
import { BuffId, DollId, Key, KeyId } from "../../../gfl2-data/types";

/** `A`, `A and B`, `A, B and C` */
function dollNames(ids: DollId[]): string {
	const names = ids.map((id) => getDollById(id).name);
	return names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}` : (names[0] ?? "");
}

export default function KeyModal() {
	const currentDoll = selectedDoll();
	if (!currentDoll) return null;
	// Early return if no doll is selected or if metadata info cannot be retrieved
	const dollInfo = createMemo(() => getSelectedDoll(currentDoll));
	const info = dollInfo();
	if (!info) return null;

	// At this point, TypeScript knows 'currentDoll' and 'info' are fully populated and safe
	const [sortedKeys, setSortedKeys] = createStore(sortEquippedKeys(currentDoll));

	const selectedKeys = createMemo(() => getPreSortedKeyInfo(currentDoll, sortedKeys));

	const allKeys = Object.values(combinedKeys.data);

	const keyTypes: Record<KeyType, Key[]> = {
		[KeyType.FixedKey]: info.keys.filter((k) => k.type === KeyType.FixedKey),
		[KeyType.ExpansionKey]: info.keys.filter((k) => k.type === KeyType.ExpansionKey),
		[KeyType.AffinityKey]: allKeys.filter((k) => k.type === KeyType.AffinityKey),
		[KeyType.CommonKey]: allKeys.filter((k) => k.type === KeyType.CommonKey),
	};

	// Opened from an issue: the key this doll needs, with the slots it fits and what swapping each one out would break
	const need = keyFocus()?.dollId === currentDoll.id ? keyFocus() : null;
	onCleanup(() => setKeyFocus(null));
	const neededKey = need ? getKeyById(need.keyId) : undefined;
	const targetSlots = neededKey
		? keyMapping.flatMap((type, slot) =>
				type === neededKey.type && (type !== KeyType.ExpansionKey || hasExpansionKey(info)) ? [slot] : []
			)
		: [];
	const neededEquipped = () => !!neededKey && sortedKeys.includes(neededKey.id);
	// keys of the needed key's type equipped on opening, so a lock stays listed after its key is moved or swapped out
	const openingKeys = neededKey ? sortedKeys.filter((keyId) => keyId && getKeyById(keyId).type === neededKey.type) : [];
	/**
	 * Keys the team still requires: those of the needed key's type, equipped now or on opening, whose absence newly causes
	 * issues. Rechecked against the keys as edited here whenever one is changed or moved, so a lock follows its key.
	 */
	const lockedKeys = createMemo(() => {
		if (!neededKey) return [];
		const current = [...sortedKeys];
		const candidates = new Set([...openingKeys, ...current.filter((keyId) => keyId && getKeyById(keyId).type === neededKey.type)]);
		candidates.delete(neededKey.id);
		return [...candidates].flatMap((keyId) => {
			// a swapped-out key is put back for the check, so its absence is measured against the keys as they are now
			const keys = current.includes(keyId) ? current : [...current, keyId];
			// the equipment screen's copy of the team, with this doll's keys as edited here
			const team = tempSelectedDolls.map((sd) => (sd.id === currentDoll.id ? { ...unwrap(sd), keys } : unwrap(sd)));
			const issues = keySwapImpact(team, currentDoll.id, keyId, "" as KeyId);
			return issues.length ? [{ keyId, issues }] : [];
		});
	});
	/**
	 * Keys equipped here whose every copy the rest of the team already uses (the player's copies, as edited on the
	 * equipment screen). Equipping one is allowed but reported as an issue on confirming. Never for a borrowed doll.
	 */
	const overLimitKeys = createMemo(() =>
		currentDoll.borrow
			? []
			: sortedKeys.flatMap((keyId) => {
					if (!keyId) return [];
					const max = maxKeyHolders(getKeyById(keyId));
					const others = keyHolders(tempSelectedDolls, keyId).filter((id) => id !== currentDoll.id);
					return max !== undefined && others.length >= max ? [{ keyId, max, others }] : [];
				})
	);
	/** With no duplicates allowed it's the same key on two dolls; otherwise there are too few copies to go around. */
	const overLimitTitle = () => {
		const overLimits = overLimitKeys();
		if (overLimits.some((overLimit) => overLimit.max > 1)) return "Not enough copies";
		const types = new Set(overLimits.map((overLimit) => getKeyById(overLimit.keyId).type));
		return types.size === 1 ? `${KeyTypeLabels[[...types][0]]} equipped on multiple dolls` : "Keys equipped on multiple dolls";
	};
	const copiesText = (keyId: KeyId, max: number, others: DollId[]) =>
		max === 1
			? `${keyName(keyId)} is already equipped on ${dollNames(others)}`
			: `All ${max} copies of ${keyName(keyId)} are already equipped (${dollNames(others)})`;
	const lockFor = (keyId: KeyId | undefined) => lockedKeys().find((lock) => lock.keyId === keyId);
	const isSwappedOut = (keyId: KeyId) => !sortedKeys.includes(keyId);
	const firstSafeSlot = targetSlots.find((slot) => !lockFor(sortedKeys[slot]));
	/** What putting the needed key in a slot would do, for slots it fits in; once it's in, why a slot's key is locked. */
	const swapText = (slot: number) => {
		if (!neededKey || !targetSlots.includes(slot)) return undefined;
		const current = sortedKeys[slot];
		const issues = lockFor(current)?.issues ?? [];
		if (neededEquipped()) {
			return current && issues.length
				? `${keyName(current)} is locked, swapping it out would cause:\n- ${issues.join("\n- ")}`
				: undefined;
		}
		// keyName tells apart same-named keys (e.g. Tololo's two "Captured Starlight")
		const what = current ? `Swapping ${keyName(current)} for ${keyName(neededKey.id)}` : `Putting ${keyName(neededKey.id)} here`;
		return issues.length ? `${what} would cause:\n- ${issues.join("\n- ")}` : `${what} causes no new issues`;
	};

	const [activeKeySlot, setActiveKeySlot] = createSignal(firstSafeSlot ?? targetSlots[0] ?? 0);
	const [keyTitle, setKeyTitle] = createSignal("");
	const [keyDescription, setKeyDescription] = createSignal("");
	const [slotSortedKeys, setSlotSortedKeys] = createSignal<KeyId[]>([...sortedKeys]);
	createEffect(on(activeKeySlot, () => setSlotSortedKeys([...sortedKeys]), { defer: true }));
	createEffect(() => {
		const selectedKey = selectedKeys()[activeKeySlot()];
		if (selectedKey) {
			setKeyTitle(selectedKey.name);
			setKeyDescription(parseEffects(selectedKey.description ?? ""));
		}
	});
	const [query, setQuery] = createSignal("");
	// Allow search filter to accept input without being focused
	// eslint-disable-next-line no-unassigned-vars
	let filterInputRef: HTMLInputElement | undefined;
	onMount(() => {
		const onKeyDown = (e: KeyboardEvent) => {
			if (document.activeElement === filterInputRef) return;
			if (e.ctrlKey || e.metaKey || e.altKey) return;
			if (e.key.length !== 1) return;
			if (document.activeElement instanceof HTMLButtonElement) return;
			filterInputRef?.focus();
		};
		window.addEventListener("keydown", onKeyDown);
		onCleanup(() => {
			window.removeEventListener("keydown", onKeyDown);
		});
	});
	const visibleKeys = createMemo(() => {
		return keyTypes[keyMapping[activeKeySlot()]];
	});

	const filteredKeys = createMemo(() => {
		const isSel = (keyId: KeyId) => {
			return slotSortedKeys().includes(keyId);
		};
		const fuse = new Fuse(visibleKeys(), {
			keys: ["dollName", "name"],
			includeScore: true,
		});
		const results = fuse.search(query());
		const isNeeded = (keyId: KeyId) => keyId === neededKey?.id;
		return results.sort((a, b) => {
			const dollAName = a.item.dollId ? getDollById(a.item.dollId).name : "";
			const dollBName = b.item.dollId ? getDollById(b.item.dollId).name : "";
			return (
				+isNeeded(b.item.id) - +isNeeded(a.item.id) ||
				+isSel(b.item.id) - +isSel(a.item.id) ||
				(a.score ?? 0) - (b.score ?? 0) ||
				(a.item.number ?? 0) - (b.item.number ?? 0) ||
				dollAName.localeCompare(dollBName) ||
				a.item.name.localeCompare(b.item.name)
			);
		});
	});

	return (
		<>
			<div class="flex max-h-180 flex-row px-10">
				{/*START SIDEBAR*/}
				<div class="flex w-30 shrink-0 flex-col items-stretch justify-center bg-[#2A3D46] py-5">
					<div class="flex justify-center pb-2">
						<img
							src={dollInfo().icons.avatar}
							loading="lazy"
							class="h-15 w-15 rounded-full border-3 border-[#687177] bg-[#0D1C1C] object-cover"
						/>
					</div>
					<For each={selectedKeys()}>
						{(selectedKey, index) => {
							const doll = dollInfo();
							if (!hasExpansionKey(doll) && index() === 3) return null;
							const isSel = () => activeKeySlot() === index();
							const selectedStyle = "border-[#F26C1C] bg-linear-to-r from-[#5B403E] to-transparent scale-107";
							const unselectedStyle =
								"cursor-pointer transition-discrete duration-175 hover:scale-107 border-transparent hover:border-white bg-linear-to-r from-transparent hover:from-[#515B61] to-transparent";
							// dimmed: the needed key doesn't fit here (still clickable)
							const dimmed = () => !!neededKey && !neededEquipped() && !targetSlots.includes(index());
							return (
								<div
									onClick={() => {
										setQuery("");
										setActiveKeySlot(index());
									}}
									title={swapText(index())}
									class={`relative flex justify-center border-l-4 py-2 ${isSel() ? selectedStyle : unselectedStyle} ${dimmed() ? "opacity-40" : ""}`}>
									<div class="relative h-15 w-15">
										<Show when={selectedKey} fallback={<EmptyKey color={isSel() ? "Light" : "Dark"} />}>
											<img
												src={selectedKey?.icon}
												decoding="async"
												width="64"
												height="64"
												class="h-16 w-16 object-cover"
											/>
										</Show>
										<Show when={selectedKey?.unreleased}>
											<UnreleasedBadge class="bottom-0 left-0 z-20 text-[10px]" />
										</Show>
									</div>
									<Show when={lockFor(sortedKeys[index()])}>
										<span class="gf-badge gf-badge-required absolute top-1 left-3 z-30">
											<Lock />
										</span>
									</Show>
								</div>
							);
						}}
					</For>
				</div>
				{/*END SIDEBAR*/}
				<div class="flex w-70 grow flex-col">
					{/* opened from an issue: what's needed, and the keys to leave in place while fitting it in */}
					<Show when={neededKey}>
						{(key) => (
							<div class={`gf-card mx-4 mt-3 flex flex-col gap-1 text-sm ${neededEquipped() ? "[--gf-accent:#3D7A4A]" : ""}`}>
								<div class="flex items-baseline gap-2 border-b border-white/15 pb-1 leading-5">
									<span class="font-bold">Need to equip {keyName(key().id)}</span>
									<Show when={neededEquipped()}>
										<span class="text-xs text-[#5FB672]">Equipped</span>
									</Show>
								</div>
								<Show
									when={!neededEquipped()}
									fallback={
										<span class="text-xs text-[#C9C8CE]">
											Confirm here, then confirm the equipment screen to apply it.
										</span>
									}>
									<span class="text-xs text-[#C9C8CE]">Issue: {need?.reason}</span>
								</Show>
								<For each={lockedKeys()}>
									{(lock) => {
										// red once it's swapped out, or while its slot is the one being changed
										const alert = () => isSwappedOut(lock.keyId) || sortedKeys.indexOf(lock.keyId) === activeKeySlot();
										return (
											<div
												class={`flex items-start gap-1.5 px-1.5 py-1 text-xs ${alert() ? "bg-[#B83D2E] text-white" : "bg-[#2A3D46] text-[#C9C8CE]"}`}>
												<span class={`gf-badge gf-badge-required h-4 w-4 shrink-0 ${alert() ? "bg-black/25" : ""}`}>
													<Lock />
												</span>
												<span class="whitespace-pre-line">
													{isSwappedOut(lock.keyId)
														? `${keyName(lock.keyId)} is locked, but was swapped out. This causes:`
														: `${keyName(lock.keyId)} is locked because swapping it out would cause:`}
													{`\n- ${lock.issues.join("\n- ")}`}
												</span>
											</div>
										);
									}}
								</For>
							</div>
						)}
					</Show>
					{/* equipped here, but every copy is already in use elsewhere on the team */}
					<Show when={overLimitKeys().length > 0}>
						<div class="gf-card mx-4 mt-3 flex flex-col gap-1 text-sm [--gf-accent:#d9542b]">
							<div class="border-b border-white/15 pb-1 leading-5 font-bold">{overLimitTitle()}</div>
							<For each={overLimitKeys()}>
								{(overLimit) => (
									<div class="flex items-start gap-1.5 text-xs text-[#C9C8CE]">
										<span class="gf-badge gf-badge-missing h-4 w-4 shrink-0">
											<Alert />
										</span>
										<span>{`${copiesText(overLimit.keyId, overLimit.max, overLimit.others)}.`}</span>
									</div>
								)}
							</For>
							<span class="text-xs text-[#C9C8CE]">{`Did you mean to mark ${dollNames([currentDoll.id])} as a borrow?`}</span>
						</div>
					</Show>
					<div class="flex grow overflow-y-auto p-5 px-4 pt-2">
						<div class="flex flex-row flex-wrap content-start items-start gap-3.5">
							<For each={visibleKeys()}>
								{(key) => {
									const isNeeded = key.id === neededKey?.id;
									// an equipped key the team still relies on, so it shouldn't be the one replaced
									const lock = () => lockFor(key.id);
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
											setSortedKeys(index, "" as KeyId);
										} else {
											setSortedKeys(activeKeySlot(), key.id);
										}
									};
									const [isVisible, setIsVisible] = createSignal(false);
									const index = createMemo(() => {
										let index = filteredKeys().findIndex((filteredKey) => key.id === filteredKey.item.id);
										// equipped keys and the key an issue needs stay listed whatever the filter
										if (index < 0 && (slotSortedKeys().includes(key.id) || isNeeded)) {
											index = 0;
										}
										setIsVisible(index > -1);
										return index > -1 ? index : 9999;
									});

									const keyDollIcon = getDollAvatarByKey(key);
									// the player's copies used by the rest of the team, as edited on the equipment screen; the borrowed
									// doll's keys aren't the player's, so they never count, and the borrowed doll is never blocked
									const max = maxKeyHolders(key);
									const others = () => keyHolders(tempSelectedDolls, key.id).filter((id) => id !== currentDoll.id);
									const unavailable = () =>
										max !== undefined && !currentDoll.borrow && !sortedKeys.includes(key.id) && others().length >= max;
									const holderCount = () => others().length + (sortedKeys.includes(key.id) ? 1 : 0);
									const overLimit = () => max !== undefined && !currentDoll.borrow && others().length >= max;

									return (
										<div
											onClick={toggleKey}
											onPointerOver={() => {
												setKeyTitle(key.name);
												setKeyDescription(parseEffects(key.description));
											}}
											title={
												isNeeded
													? need?.reason
													: lock()
														? `Locked, swapping it out would cause:\n- ${lock()?.issues.join("\n- ")}`
														: overLimit() && max !== undefined
															? `${copiesText(key.id, max, others())}. ${sortedKeys.includes(key.id) ? "Confirming shows this as an issue." : "Equipping it here shows as an issue."}`
															: others().length
																? `Equipped on ${dollNames(others())}`
																: undefined
											}
											class={`${interactiveStyles(isSel())} inset-shadow-2xl relative flex flex-col rounded-sm border-3 border-[#B2B1B6] bg-[#95999B] shadow-black/75 ${isVisible() ? "" : "hidden"} ${unavailable() ? "opacity-40" : ""}`}
											style={{ order: index() }}>
											<Show when={isSel() !== false}>
												<div class="absolute top-1 right-1 z-20 h-7 w-7 shadow-sm shadow-black/20">
													<Check />
												</div>
											</Show>
											<div class="absolute top-1 left-1 z-20 flex flex-col gap-0.5">
												<Show when={isNeeded && !neededEquipped()}>
													<div class="gf-badge gf-badge-recommended">
														<ThumbsUp />
													</div>
												</Show>
												<Show when={overLimit() && sortedKeys.includes(key.id)}>
													<div class="gf-badge gf-badge-missing">
														<Alert />
													</div>
												</Show>
												<Show when={lock()}>
													<div class="gf-badge gf-badge-required">
														<Lock />
													</div>
												</Show>
												<Show when={others()[0]}>
													{(holder) => (
														<img
															src={getDollById(holder()).icons.avatar}
															decoding="async"
															width="28"
															height="28"
															class="h-7 w-7 rounded-full border-2 border-white bg-[#C9C8CE] object-cover object-top"
														/>
													)}
												</Show>
											</div>
											{/* only shown once a key can have more than one copy */}
											<Show when={max !== undefined && max > 1}>
												<div class="pointer-events-none absolute top-9 right-1 z-20 rounded-sm bg-[#2A3D46] px-1 text-xs font-bold text-[#EFEFEF]">
													{`${holderCount()}/${max} equipped`}
												</div>
											</Show>
											<div class={`${rarityBorderColor(key.rarity)} relative border-b-5`}>
												<img
													src={key.icon}
													loading="lazy"
													decoding="async"
													width="88"
													height="88"
													class="h-22 w-22 object-cover"
												/>
												<Show when={key.unreleased}>
													<UnreleasedBadge />
												</Show>
												<Show when={key.number !== null}>
													<div class="absolute right-1 bottom-1 rounded-sm bg-[#2A3D46] px-1 text-xs font-bold text-[#EFEFEF]">
														{key.number}
													</div>
												</Show>
												{keyDollIcon && (
													<div class="absolute right-1 bottom-2 z-20 h-8 w-8 overflow-hidden rounded-full border-2 border-white bg-[#C9C8CE]">
														<div class="relative -top-1 -left-2.5 w-12">
															<img
																src={keyDollIcon}
																loading="lazy"
																decoding="async"
																width="48"
																height="48"
																class="w-full object-cover object-top"
															/>
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
					<div class="flex shrink flex-row flex-wrap gap-1 p-2 pl-4">
						<div class="flex font-bold">{keyTitle()}</div>
						<div
							innerHTML={keyDescription()}
							onClick={(e) => {
								// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
								const target = (e.target as HTMLElement).closest("[data-effect-id]") as HTMLElement | null;
								if (!target) return;
								const rect = target.getBoundingClientRect();
								const popupWidth = 360;
								const popupHeight = 384;
								const margin = 8;
								const x = Math.max(margin, Math.min(rect.left, window.innerWidth - popupWidth - margin));
								const y = Math.max(margin, Math.min(rect.bottom + 4, window.innerHeight - popupHeight - margin));
								setEffectModalPosition({ x, y });
								const effectId = target.dataset.effectId;
								if (effectId) {
									setEffectModalEffects(getReferencedEffects(effectId as BuffId));
								}
								setShowEffectModal(true);
							}}></div>
					</div>
					<div class="flex p-2">
						<div class="flex grow justify-center p-2">
							<input
								ref={filterInputRef}
								class="input"
								type="text"
								value={query()}
								onInput={(e) => setQuery(e.target.value)}
								placeholder="Filter..."
							/>
						</div>
						<Button
							onClick={() => {
								const doll = selectedDoll();
								if (doll) {
									setDollKeys(doll.id, sortedKeys);
								}
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
