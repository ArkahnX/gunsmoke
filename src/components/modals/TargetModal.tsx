import { For, createMemo, onCleanup } from "solid-js";
import { produce } from "solid-js/store";
import Button from "../buttons/Button";
import DollChip from "../DollChip";
import { retargetAction, setRetargetAction, setShowTargetModal, targetDollId, targetSkillId } from "../../store/uiState";
import { localState, setState } from "../../store/appState";
import { getSelectedDollAndSummonInfo, getSkillById } from "../../store/gameData";
import { Doll, DollId, Summon, SummonId } from "../../../gfl2-data/types";
import { SaveV9Action } from "../../types/saves";
import { saveToLocalStorage } from "../../store/storage";

export default function TargetModal() {
	// opened from the issues modal to replace an existing action's target, rather than to record a new action
	const retarget = retargetAction();
	onCleanup(() => setRetargetAction(null));

	const skillInfo = createMemo(() => {
		const skillId = targetSkillId();
		if (skillId) {
			return getSkillById(skillId);
		}
		return null;
	});

	// the action's own turn, which can differ from the open tab when retargeting
	const targets = createMemo(() => getSelectedDollAndSummonInfo([targetDollId()], true, retarget?.tab ?? localState.currentTab));

	const recordSkill = (dollId: DollId | SummonId, entry: SaveV9Action) => {
		setState(
			produce((s) => {
				const tab = s.tabData[localState.currentTab];
				if (!tab.actions[dollId]) tab.actions[dollId] = [];
				tab.actions[dollId].push(entry);
			})
		);
		saveToLocalStorage();
	};

	const replaceTarget = (target: Doll | Summon) => {
		if (!retarget) return;
		setState(
			produce((s) => {
				const action = s.tabData[retarget.tab]?.actions[retarget.ownerId]?.[retarget.index] as SaveV9Action | undefined;
				// only if it's still the same skill use, in case the timeline changed while the picker was open
				if (action?.[0] === targetSkillId()) action[1] = target.id;
			})
		);
		saveToLocalStorage();
	};

	const handleSelect = (target: Doll | Summon) => {
		const dollId = targetDollId();
		const skillId = targetSkillId();
		if (!dollId || skillId == null) return;
		if (retarget) replaceTarget(target);
		else recordSkill(dollId, [skillId, target.id]);
		setShowTargetModal(false);
	};

	return (
		<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/90">
			<div class="overflow-hidden rounded-sm border-t-[6px] border-[#506A6C] bg-[#293438]">
				<div class="border-b border-zinc-700 p-6 text-center">
					<h3 class="text-lg font-bold">{retarget ? "Select New Target" : "Select Target Character"}</h3>
					<p class="text-xs text-zinc-400">
						{skillInfo()?.name} → Target{retarget ? ` (${retarget.tab === 0 ? "setup" : `turn ${retarget.tab}`})` : ""}
					</p>
				</div>

				<div class="grid grid-cols-3 justify-items-center gap-4 p-5">
					<For each={targets()}>
						{(doll) => (
							<DollChip
								onClick={() => {
									handleSelect(doll);
								}}
								target={doll}
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
