import { For } from "solid-js";
import {
	allDolls,
	tempSelected,
	setTempSelected,
	dollFortification,
	setDollFortification,
	setShowFortificationModal,
	state,
	changeSelectedDolls,
	preloadCanvasImages,
	saveToLocalStorage,
	defaultActionOrder,
} from "../../store";
import SmallDollChip from "../SmallDollChip";
import Button from "../buttons/Button";
import ModalHeader from "./ModalHeader";
import ModalFooter from "./ModalFooter";

export default function FortificationModal() {
	const setNum = (dollId: string, num: number) => {
		setDollFortification((prev) => ({ ...prev, [dollId]: num }));
	};

	const confirm = async () => {
		setShowFortificationModal(false);
		const selectedDolls = tempSelected().map((dollId) => ({
			id: dollId,
			fortification: dollFortification()[dollId] ?? 0,
		}));
		changeSelectedDolls(selectedDolls);
		await preloadCanvasImages();
		setTempSelected([]);
		for (let i = 0; i < 8; i++) defaultActionOrder(i);
		saveToLocalStorage();
	};

	return (
		<>
			<ModalHeader title="Set Doll Fortifications" />
			<div class="flex flex-col items-center gap-3 p-2">
				<For each={tempSelected()}>
					{(dollId) => {
						const dollInfo = allDolls().find((d) => d.id === dollId);
						if (!dollInfo) return null;
						const currentNum = () =>
							dollFortification()[dollId] ?? state.selectedDolls.find((d) => d.id === dollId)?.fortification ?? 0;
						return (
							<div class="flex items-center gap-4">
								<SmallDollChip target={dollInfo} doll={dollInfo} />
								<div class="flex gap-2">
									<For each={[0, 1, 2, 3, 4, 5, 6]}>
										{(n) => (
											<button
												onClick={() => setNum(dollId, n)}
												class={`text-md h-9 w-9 cursor-pointer rounded-sm bg-[#384B53] font-bold text-[#EFEFEF] shadow-sm shadow-black/50 outline-3 transition-all hover:scale-107 hover:outline-white ${currentNum() === n ? "outline-[#F26C1C]" : "outline-transparent"}`}>
												{n}
											</button>
										)}
									</For>
								</div>
							</div>
						);
					}}
				</For>
			</div>
			<ModalFooter styles="justify-center">
				<Button onClick={confirm} color="dark" design="confirm" />
			</ModalFooter>
		</>
	);
}
