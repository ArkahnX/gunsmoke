import { For, createMemo } from "solid-js";
import {
	showTargetModal,
	setShowTargetModal,
	targetDollId,
	targetSkillId,
	state,
	setState,
	getSelectedDollAndSummonInfo,
	getDollInfoFromId,
	getSortedUsableSkills,
	saveToLocalStorage,
	defaultActionOrder,
	getDollFromSummon,
} from "../../store";
import { produce } from "solid-js/store";
import type { DollData, SummonData } from "../../types";
import Button from "../buttons/Button";
import DollChip from "../DollChip";

export default function TargetModal() {
	const skillInfo = createMemo(() => {
		const dollId = targetDollId();
		const skillId = targetSkillId();
		if (!dollId || skillId == null) return null;
		const doll = getDollInfoFromId(dollId);
		return doll?.skills.find((s) => s.id === skillId) ?? null;
	});

	const targets = createMemo(() => getSelectedDollAndSummonInfo([targetDollId() ?? ""]));

	const recordSkill = (dollId: string, entry: [number, string?]) => {
		setState(
			produce((s) => {
				const tab = s.tabData[s.currentTab]!;
				if (!tab.actions[dollId]) tab.actions[dollId] = [];
				tab.actions[dollId]!.push(entry);
				if (!tab.actionOrder.includes(dollId)) tab.actionOrder.push(dollId);
			})
		);
		saveToLocalStorage();
	};

	const handleSelect = (target: DollData | SummonData) => {
		const dollId = targetDollId();
		const skillId = targetSkillId();
		if (!dollId || skillId == null) return;
		recordSkill(dollId, [skillId, target.id]);
		setShowTargetModal(false);
	};

	return (
		<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/90">
			<div class="overflow-hidden rounded-sm border-t-[6px] border-[#506A6C] bg-[#293438]">
				<div class="border-b border-zinc-700 p-6 text-center">
					<h3 class="text-lg font-bold">Select Target Character</h3>
					<p class="text-xs text-zinc-400">{skillInfo()?.name} → Target</p>
				</div>

				<div class="grid grid-cols-3 justify-items-center gap-4 p-5">
					<For each={targets()}>
						{(doll) => (
							<DollChip
								onClick={() => handleSelect(doll)}
								target={doll}
								doll={getDollFromSummon(doll)}
								style={`--animation-order: ${targets().findIndex((d) => d.id === doll.id)};order:${targets().findIndex((d) => d.id === doll.id)}`}
							/>
						)}
					</For>
				</div>

				<div class="flex justify-center gap-4 border-t border-zinc-700 p-6">
					<Button onClick={() => setShowTargetModal(false)} color="light" design="cancel" />
				</div>
			</div>
		</div>
	);
}
