import { createMemo, createSignal, For, Show } from "solid-js";
import { getInfoFromId, setShowWeaponModal, setDollWeapon, allWeapons, interactiveStyles, defaultWeapons, selectedDoll } from "../../store";
import Button from "../buttons/Button";
import ModalHeader from "./ModalHeader";
import ModalFooter from "./ModalFooter";
import { DollData } from "../../types";
import Check from "../icons/Check";

export default function WeaponModal() {
	const dollInfo = createMemo(() => getInfoFromId(selectedDoll()!.id) as DollData | null);
	if (!dollInfo()) return null;
	const dollWeapon = createMemo(() => {
		let gun = allWeapons.find((w) => w.id === selectedDoll()!.gun);
		if (!gun) gun = allWeapons.find((w) => w.imprintId === selectedDoll()!.id);
		if (!gun) gun = defaultWeapons[dollInfo()!.gunType];
		return gun;
	});
	const [selectedWeaponId, setSelectedWeaponId] = createSignal<string>(dollWeapon()?.id ?? "");
	const visibleWeapons = allWeapons.filter((weapon) => weapon.type === dollInfo()!.gunType);
	return (
		<>
			<ModalHeader title="Select Weapon" />
			<div class="h-100 overflow-y-scroll p-2 px-4">
				<div class="flex flex-row flex-wrap gap-4">
					<For each={visibleWeapons}>
						{(weapon) => {
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
									<Show when={weapon.imprintImage}>
										<div class="absolute bottom-1 left-2 z-10 h-12 w-12">
											<img src={weapon.imprintImage!} class="relative h-full w-full object-cover" />
										</div>
									</Show>
									<div
										class={`absolute bottom-1 z-10 w-full text-right font-bold ${weapon.imprintId === null ? "pl-2" : "pl-15"} overflow-hidden pr-2 text-ellipsis whitespace-nowrap`}>
										{weapon.name}
									</div>
									<img
										src={weapon.localImagePath}
										class="relative z-20 h-full w-full border-b-3 border-[#DF9E00] object-cover"
									/>
									<div class="absolute bottom-0 left-0 z-0 h-full w-full bg-linear-to-t from-[#453824] from-0% to-transparent to-75%"></div>
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
						setDollWeapon(selectedDoll()!.id, selectedWeaponId());
					}}
					color="dark"
					design="confirm"
				/>
			</ModalFooter>
		</>
	);
}
