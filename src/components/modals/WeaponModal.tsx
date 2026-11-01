import { createSignal, For, Show } from "solid-js";
import Button from "../buttons/Button";
import ModalHeader from "./ModalHeader";
import ModalFooter from "./ModalFooter";
import Check from "../icons/Check";
import UnreleasedBadge from "../icons/UnreleasedBadge";
import { selectedDoll, setShowWeaponModal } from "../../store/uiState";
import { interactiveStyles, rarityBorderColor, rarityGradientColor } from "../../store/effects";
import { setDollWeapon } from "../../store/dollSelection";
import { combinedWeapons, getDollChibiIconByWeapon, getSelectedDoll, getWeaponByDollId, getWeaponById } from "../../store/gameData";
import { Weapon, WeaponId } from "../../../gfl2-data/types";
import { isRenderable } from "../../store/validation";
import { LocationKey } from "../../types/issues";

function sortWeapons(weaponA: Weapon, weaponB: Weapon) {
	return weaponB.rarity - weaponA.rarity || weaponA.name.localeCompare(weaponB.name);
}

export default function WeaponModal() {
	const sd = selectedDoll();
	if (!sd) return null;
	const doll = getSelectedDoll(sd);
	// an unknown weapon (reported by validateSave) displays as the doll's signature weapon
	const weapon = isRenderable({ kind: LocationKey.DollWeapon, dollId: sd.id }) ? getWeaponById(sd.gun) : getWeaponByDollId(sd.id);

	const [selectedWeaponId, setSelectedWeaponId] = createSignal<WeaponId>(weapon.id);

	const visibleWeapons = Object.values(combinedWeapons.data)
		.filter((weapon) => weapon.gunType === doll.gunType)
		.sort(sortWeapons);

	return (
		<>
			<ModalHeader title="Select Weapon" />
			<div class="h-100 overflow-y-scroll p-2 px-4">
				<div class="flex flex-row flex-wrap gap-4">
					<For each={visibleWeapons}>
						{(weapon) => {
							const chibiIcon = getDollChibiIconByWeapon(weapon);
							const isSel = () => selectedWeaponId() === weapon.id;
							return (
								<div
									onClick={() => setSelectedWeaponId(weapon.id)}
									class={`${interactiveStyles(isSel())} relative flex h-25.5 w-48.5 flex-col items-center justify-center overflow-hidden rounded-sm bg-[#354346] px-1.5 py-1 shadow-sm shadow-black/50`}>
									{isSel() && (
										<div class="absolute top-1 right-1 h-7 w-7 shadow-sm shadow-black/20">
											<Check />
										</div>
									)}
									<Show when={chibiIcon}>
										<div class="absolute bottom-1 left-2 z-20 h-12 w-12">
											<img
												src={chibiIcon}
												loading="lazy"
												decoding="async"
												width="48"
												height="48"
												class="relative h-full w-full object-cover"
											/>
										</div>
									</Show>
									<div
										class={`absolute bottom-1 z-20 w-full text-right font-bold ${chibiIcon === "" ? "pl-2" : "pl-15"} overflow-hidden pr-2 text-ellipsis whitespace-nowrap`}>
										{weapon.name}
									</div>
									<img
										src={weapon.icon}
										loading="lazy"
										decoding="async"
										width="194"
										height="97"
										class={`relative z-10 h-full w-full border-b-3 ${rarityBorderColor(weapon.rarity)} object-cover`}
									/>
									<Show when={weapon.unreleased}>
										<UnreleasedBadge class="top-1 left-1 z-30 text-xs" />
									</Show>
									<div
										class={`absolute bottom-0 left-0 z-0 h-full w-full bg-linear-to-t ${rarityGradientColor(weapon.rarity)} from-0% to-transparent to-75%`}></div>
								</div>
							);
						}}
					</For>
				</div>
			</div>

			{/* Footer */}
			<ModalFooter styles="justify-between">
				<Button onClick={() => setShowWeaponModal(false)} color="dark" design="cancel" />
				<Button
					onClick={() => {
						setShowWeaponModal(false);

						const doll = selectedDoll();
						if (doll) {
							setDollWeapon(doll.id, selectedWeaponId());
						}
					}}
					color="dark"
					design="confirm"
				/>
			</ModalFooter>
		</>
	);
}
