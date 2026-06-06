import { createSignal, For } from "solid-js";
import { interactiveStyles, setShowBuffModal, allBuffs, setBuffs, state, sortBuffs } from "../../store";
import Button from "../buttons/Button";
import ModalHeader from "./ModalHeader";
import ModalFooter from "./ModalFooter";
import Check from "../icons/Check";
import { CURRENT_SEASON } from "../../types/constants";
import { Buffs } from "../Buffs";

export default function BuffModal() {
	const [selectedBuffs, setSelectedBuffs] = createSignal<string[]>([...state.buffs]);
	const sortedBuffs = [...allBuffs].sort(sortBuffs);
	return (
		<>
			<ModalHeader title="Select Seasonal Buffs" />
			<div class="h-100 overflow-y-scroll p-2 px-4">
				<div class="flex flex-row flex-wrap gap-4">
					<For each={sortedBuffs}>
						{(buff) => {
							const isSel = () => selectedBuffs().includes(buff.id);
							const toggleBuff = () =>
								setSelectedBuffs((buffs) =>
									selectedBuffs().includes(buff.id) ? selectedBuffs().filter((b) => b !== buff.id) : [...buffs, buff.id]
								);
							const days = () => {
								if (buff.core && buff.season === CURRENT_SEASON) {
									return "Effective this season";
								}
								if (buff.days && buff.days[CURRENT_SEASON]) {
									return "Available on days " + buff.days[CURRENT_SEASON].map((day) => day + 1).join(", ");
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
									<div
										class={`relative flex h-15 w-15 shrink-0 ${buff.core ? "bg-[#0D76A1]" : "bg-[#2D464E]"} rounded-sm`}>
										<img src={buff.localImagePath} class="relative z-20 h-full w-full object-cover" />
									</div>
									<div class="flex grow flex-col gap-3 text-[#384B53]">
										<div class="flex grow flex-row gap-3 border-b-2 border-[#E0DDE7]">
											<div class="text-left font-bold text-black">{buff.name}</div>
											<div class="text-left">{days()}</div>
										</div>
										<div class="text-left">
											<Buffs id={buff.id} />
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
