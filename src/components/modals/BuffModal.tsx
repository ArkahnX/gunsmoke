import { createSignal, For } from "solid-js";
import Button from "../buttons/Button";
import ModalHeader from "./ModalHeader";
import ModalFooter from "./ModalFooter";
import Check from "../icons/Check";
import { state } from "../../store/appState";
import { setShowBuffModal } from "../../store/uiState";
import { setBuffs } from "../../store/dollSelection";
import { interactiveStyles } from "../../store/effects";
import { getBuffById, getCurrentSeason, sortBuffs } from "../../store/gameData";
import { BuffId } from "../../../gfl2-data/types";
import { Buffs } from "../../../gfl2-data/buffs";

export default function BuffModal() {
	const [selectedBuffs, setSelectedBuffs] = createSignal<BuffId[]>([...state.buffs]);
	const season = getCurrentSeason();
	const buffIds = Object.keys(season.dailyBuffIds) as BuffId[];
	buffIds.push(season.buffId);
	const sortedBuffs = buffIds.sort(sortBuffs);
	return (
		<>
			<ModalHeader title="Select Seasonal Buffs" />
			<div class="h-100 overflow-y-scroll p-2 px-4">
				<div class="flex flex-row flex-wrap gap-4">
					<For each={sortedBuffs}>
						{(buff) => {
							const isSel = () => selectedBuffs().includes(buff);
							const isCore = buff === season.buffId;
							const info = getBuffById(buff);
							const toggleBuff = () =>
								setSelectedBuffs((buffs) =>
									selectedBuffs().includes(buff) ? selectedBuffs().filter((b) => b !== buff) : [...buffs, buff]
								);
							const days = () => {
								if (buff === season.buffId) {
									return "Effective this season";
								}
								if (season.dailyBuffIds[buff]) {
									return "Available on days " + season.dailyBuffIds[buff].join(", ");
								}
								return "Unavailable this gunsmoke season";
							};
							return (
								<div
									onClick={() => toggleBuff()}
									class={`${interactiveStyles(isSel())} relative flex grow flex-row items-start gap-3 rounded-sm bg-[#F2EEF8] p-2.5 shadow-sm shadow-black/20 hover:scale-100!`}>
									{isSel() && (
										<div class="absolute top-1 right-1 h-7 w-7 shadow-sm shadow-black/20">
											<Check />
										</div>
									)}
									<div class={`relative flex h-15 w-15 shrink-0 ${isCore ? "bg-[#0D76A1]" : "bg-[#2D464E]"} rounded-sm`}>
										<img src={info.icon} class="relative z-20 h-full w-full object-cover" />
									</div>
									<div class="flex grow flex-col gap-3 text-[#384B53]">
										<div class="flex grow flex-row gap-3 border-b-2 border-[#E0DDE7]">
											<div class="text-left font-bold text-black">{info.name}</div>
											<div class="text-left">{days()}</div>
										</div>
										<div class="text-left">
											<Buffs id={buff} />
										</div>
									</div>
								</div>
							);
						}}
					</For>
				</div>
			</div>
			<div class="text-md mx-3 mt-1.75 flex h-10 items-center justify-center self-stretch bg-[#384B53] font-bold tracking-wide text-[#ECECEC]">
				Select one or more buffs relevant to this transcript
			</div>
			{/* Footer */}
			<ModalFooter styles="justify-between">
				<Button onClick={() => setShowBuffModal(false)} color="dark" design="cancel" />
				<Button
					onClick={() => {
						setShowBuffModal(false);
						setBuffs(selectedBuffs());
					}}
					color="dark"
					design="confirm"
				/>
			</ModalFooter>
		</>
	);
}
