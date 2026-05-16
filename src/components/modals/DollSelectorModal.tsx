import { createMemo, For } from "solid-js";
import {
	activePhaseTab,
	setActivePhaseTab,
	setShowDollModal,
	visibleDollIndex,
	allDolls,
	tempSelectedDolls,
	removeDollFromTempSelect,
	addDollToTempSelect,
	setShowFormationModal,
	runAfterFramePaint,
} from "../../store";
import { PHASE_TABS } from "../../types";
import Phase from "../icons/Phase";
import DollChip from "../DollChip";
import Button from "../buttons/Button";
import ModalHeader from "./ModalHeader";
import ModalFooter from "./ModalFooter";

export default function DollSelectorModal() {
	const selectedDollIds = createMemo(() => tempSelectedDolls.map((doll) => doll.id));
	const toggleDoll = (id: string) => {
		if (selectedDollIds().includes(id)) {
			removeDollFromTempSelect(id);
		} else if (selectedDollIds().length < 5) {
			addDollToTempSelect(id);
		}
	};

	const toggleDollVisibility = async (phase: string) => {
		runAfterFramePaint(() => {
			document.querySelectorAll(`.doll`).forEach((el) => {
				el.classList.remove("show");
			});
			runAfterFramePaint(() => {
				document.querySelectorAll(`.doll.${phase}`).forEach((el) => {
					el.classList.remove("hide");
					el.classList.add("show");
				});
				runAfterFramePaint(() => {
					document.querySelectorAll(`.doll:not(.${phase})`).forEach((el) => {
						el.classList.add("hide");
					});
				});
			});
		});

		// await new Promise((resolve) => setTimeout(resolve, 150));
		// document.querySelectorAll(`.doll.${phase}`).forEach((el) => {
		// 	el.classList.remove("hide");
		// 	el.classList.add("show");
		// });
	};

	return (
		<>
			<ModalHeader title="Select Dolls" />
			{/* Phase tabs */}
			<div class="flex gap-1 px-3 pb-1.75">
				<For each={PHASE_TABS}>
					{(tab) => (
						<button
							onClick={() => {
								setActivePhaseTab(tab);
								toggleDollVisibility(tab);
							}}
							class={`flex h-13 flex-1 items-center justify-center gap-1 rounded-t-sm border-b-4 px-1 pt-3 pb-2 text-2xl font-bold transition-all ${
								activePhaseTab() === tab
									? "border-[#F0AF16] bg-[#384B53] text-[#EFEFEF] shadow-xl/20"
									: "border-[#8F9094] bg-[#A8A9AE] text-[#384B53] hover:border-[#606164]"
							}`}>
							<div class="h-6 w-6">
								<Phase phase={tab} fill={activePhaseTab() === tab ? "#EFEFEF" : "#384B53"} />
							</div>
							<span>{tab}</span>
						</button>
					)}
				</For>
			</div>

			{/* Doll grid */}
			<div class="h-100 overflow-y-scroll p-2 px-4">
				<div class="grid grid-cols-6 gap-4">
					<For each={allDolls}>
						{(doll) => {
							const isSel = () => selectedDollIds().includes(doll.id);
							return (
								<DollChip
									target={doll}
									doll={doll}
									selected={isSel()}
									onClick={() => toggleDoll(doll.id)}
									style={`--animation-order: ${visibleDollIndex(doll)};order:${visibleDollIndex(doll)}`}
								/>
							);
						}}
					</For>
				</div>
			</div>
			<div class="text-md mx-3 mt-1.75 flex h-10 items-center justify-center self-stretch bg-[#384B53] font-bold tracking-wide text-[#ECECEC]">
				Changing dolls will clear their positions and actions
			</div>

			{/* Footer */}
			<ModalFooter styles="justify-between">
				<Button onClick={() => setShowDollModal(false)} color="dark" design="cancel" />
				<Button
					onClick={() => {
						setShowDollModal(false);
						setShowFormationModal(true);
					}}
					color="dark"
					design="confirm"
				/>
			</ModalFooter>
		</>
	);
}
