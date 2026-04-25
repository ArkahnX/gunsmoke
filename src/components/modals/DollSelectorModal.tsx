import { For } from "solid-js";
import {
	allDolls,
	tempSelected,
	setTempSelected,
	activePhaseTab,
	setActivePhaseTab,
	setShowDollModal,
	setShowFortificationModal,
} from "../../store";
import { DollData, PHASE_TABS } from "../../types";
import Phase from "../icons/Phase";
import DollChip from "../DollChip";
import Button from "../buttons/Button";
import ModalHeader from "./ModalHeader";
import ModalFooter from "./ModalFooter";

function runAfterFramePaint(callback: () => void) {
	// Queue a "before Render Steps" callback via requestAnimationFrame.
	requestAnimationFrame(() => {
		const messageChannel = new MessageChannel();

		// Setup the callback to run in a Task
		messageChannel.port1.onmessage = callback;

		// Queue the Task on the Task Queue
		messageChannel.port2.postMessage(undefined);
	});
}

export default function DollSelectorModal() {
	const toggleDoll = (id: string) => {
		const sel = tempSelected();
		if (sel.includes(id)) {
			setTempSelected(sel.filter((x) => x !== id));
		} else if (sel.length < 5) {
			setTempSelected([...sel, id]);
		}
	};

	const isVisible = (phase: string) => {
		return activePhaseTab() === "All" || phase === activePhaseTab();
	};

	const visibleDollIndex = (doll: DollData) => {
		const dolls = allDolls().filter((d) => isVisible(d.phase));
		const index = dolls.findIndex((d) => d.id === doll.id);
		if (index === -1) return allDolls().length;
		return index;
	};

	const toggleDollVisibility = async (phase: string) => {
		console.log("Running Phase Tab for " + phase);
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
					<For each={allDolls()}>
						{(doll) => {
							const isSel = () => tempSelected().includes(doll.id);
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
						setShowFortificationModal(true);
					}}
					disabled={tempSelected().length !== 5}
					color="dark"
					design="confirm"
				/>
			</ModalFooter>
		</>
	);
}
