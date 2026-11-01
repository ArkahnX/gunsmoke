import { createMemo, createSignal, For, onMount } from "solid-js";
import PhaseIcon from "../icons/Phase";
import DollChip from "../DollChip";
import Button from "../buttons/Button";
import ModalHeader from "./ModalHeader";
import ModalFooter from "./ModalFooter";
import { tempSelectedDolls } from "../../store/appState";
import { activePhaseTab, setActivePhaseTab, setShowDollModal, setShowFormationModal, visibleDollIndex } from "../../store/uiState";
import { addDollToTempSelect, removeDollFromTempSelect } from "../../store/dollSelection";
import { runAfterFramePaint } from "../../store/scheduling";
import { Phase, PhaseLabels } from "../../../gfl2-data/enums";
import { combinedDolls } from "../../store/gameData";
import { Doll, DollId } from "../../../gfl2-data/types";
import { MAX_TEAM_SIZE } from "../../types/constants";

export default function DollSelectorModal() {
	const phaseTabs = [Phase.All, Phase.Physical, Phase.Burn, Phase.Electric, Phase.Freeze, Phase.Corrosion, Phase.Hydro];
	const selectedDollIds = createMemo(() => tempSelectedDolls.map((doll) => doll.id));

	const [pinnedIds, setPinnedIds] = createSignal<DollId[]>([]);
	const snapshotPinned = () => setPinnedIds(tempSelectedDolls.map((doll) => doll.id));
	onMount(snapshotPinned);

	const dollOrder = (doll: Doll) => {
		const i = pinnedIds().indexOf(doll.id);
		return i !== -1 ? i : pinnedIds().length + visibleDollIndex(doll);
	};

	const toggleDoll = (id: DollId) => {
		if (selectedDollIds().includes(id)) {
			removeDollFromTempSelect(id);
		} else if (selectedDollIds().length < MAX_TEAM_SIZE) {
			addDollToTempSelect(id);
		}
	};

	const toggleDollVisibility = (phase: Phase) => {
		runAfterFramePaint(() => {
			document.querySelectorAll(`.doll`).forEach((el) => {
				el.classList.remove("show");
			});
			runAfterFramePaint(() => {
				document.querySelectorAll(`.doll.${PhaseLabels[phase]}, .doll.pinned`).forEach((el) => {
					el.classList.remove("hide");
					el.classList.add("show");
				});
				runAfterFramePaint(() => {
					document.querySelectorAll(`.doll:not(.${PhaseLabels[phase]}):not(.pinned)`).forEach((el) => {
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
				<For each={phaseTabs}>
					{(tab) => (
						<button
							onClick={() => {
								snapshotPinned();
								setActivePhaseTab(tab);
								toggleDollVisibility(tab);
							}}
							class={`flex h-13 flex-1 items-center justify-center gap-1 rounded-t-sm border-b-4 px-1 pt-3 pb-2 text-2xl font-bold transition-all ${
								activePhaseTab() === tab
									? "border-[#F0AF16] bg-[#384B53] text-[#EFEFEF] shadow-xl/20"
									: "border-[#8F9094] bg-[#A8A9AE] text-[#384B53] hover:border-[#606164]"
							}`}>
							<div class="h-6 w-6">
								<PhaseIcon phase={tab} fill={activePhaseTab() === tab ? "#EFEFEF" : "#384B53"} />
							</div>
							<span>{PhaseLabels[tab]}</span>
						</button>
					)}
				</For>
			</div>

			{/* Doll grid */}
			<div class="h-100 overflow-y-scroll p-2 px-4">
				<div class="grid grid-cols-6 gap-4">
					<For each={Object.values(combinedDolls.data)}>
						{(doll) => {
							const isSel = () => selectedDollIds().includes(doll.id);
							return (
								<DollChip
									target={doll}
									selected={isSel()}
									pinned={pinnedIds().includes(doll.id)}
									onClick={() => {
										toggleDoll(doll.id);
									}}
									style={`--animation-order: ${dollOrder(doll)};order:${dollOrder(doll)}`}
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
