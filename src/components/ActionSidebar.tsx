import { For, Show, createMemo } from "solid-js";
import { produce } from "solid-js/store";
import {
	state,
	setState,
	getSortedUsableSkills,
	isPlaced,
	renderAction,
	saveToLocalStorage,
	setShowTargetModal,
	setTargetDollId,
	setTargetSkillId,
	getDollFromSummon,
	getInfoFromId,
} from "../store";
import type { SkillAction, DollRowProps } from "../types";
import SkillIcon from "./icons/SkillIcon";
import SquareDollChip from "./SquareDollChip";

function handleSkillClick(dollId: string, sortedIdx: number) {
	if (!isPlaced(dollId)) {
		alert("Place doll first!");
		return;
	}
	const doll = getInfoFromId(dollId);
	if (!doll) return;
	const sorted = getSortedUsableSkills(doll);
	const skill = sorted[sortedIdx];
	if (!skill) return;
	const hasActiveBuff =
		skill.range !== "Self" &&
		skill.range !== null &&
		skill.name !== "Absolute Mental Defense" &&
		skill.name !== "Honor Guard" &&
		skill.tags &&
		(skill.tags.includes("Healing") || skill.tags.includes("Buff")) &&
		!skill.tags.includes("Targeted") &&
		!skill.tags.includes("Tile");
	if (hasActiveBuff || skill.name === "Light of Bond" || skill.name === "Bad Influence") {
		setTargetDollId(dollId);
		setTargetSkillId(skill.id);
		setShowTargetModal(true);
	} else {
		recordSkill(dollId, [skill.id]);
	}
}

function recordSkill(dollId: string, entry: SkillAction) {
	if (state.currentTab < 0 || state.currentTab > 7) return;
	setState(
		produce((s) => {
			const tab = s.tabData[s.currentTab]!;
			if (!tab.actions[dollId]) tab.actions[dollId] = [];
			tab.actions[dollId]!.push(entry);
		})
	);
	saveToLocalStorage();
}

function removeAction(dollId: string, actionIdx: number) {
	setState(
		produce((s) => {
			s.tabData[s.currentTab]!.actions[dollId]?.splice(actionIdx, 1);
		})
	);
	saveToLocalStorage();
}

function UpButton(props: { dollId: string }) {
	return (
		<button
			onClick={() => {
				setState(
					produce((s) => {
						const tab = s.tabData[s.currentTab]!;
						const index = tab.actionOrder.indexOf(props.dollId);
						const targetIndex = index - 1;
						const targetDollId = tab.actionOrder[targetIndex];
						tab.actionOrder[index] = targetDollId;
						tab.actionOrder[targetIndex] = props.dollId;
					})
				);
				saveToLocalStorage();
			}}
			class="cursor-pointer rounded-sm bg-[#384B53] p-0.5 hover:outline-3 hover:outline-white">
			Up
		</button>
	);
}

function DownButton(props: { dollId: string }) {
	return (
		<button
			onClick={() => {
				setState(
					produce((s) => {
						const tab = s.tabData[s.currentTab]!;
						const index = tab.actionOrder.indexOf(props.dollId);
						const targetIndex = index + 1;
						const targetDollId = tab.actionOrder[targetIndex];
						tab.actionOrder[index] = targetDollId;
						tab.actionOrder[targetIndex] = props.dollId;
					})
				);
				saveToLocalStorage();
			}}
			class="cursor-pointer rounded-sm bg-[#384B53] p-0.5 hover:outline-3 hover:outline-white">
			Down
		</button>
	);
}

function DollRow(props: DollRowProps) {
	const dollInfo = getInfoFromId(props.dollId);
	const placed = createMemo(() => isPlaced(props.dollId));
	const actions = createMemo(() => state.tabData[state.currentTab]?.actions[props.dollId] ?? []);
	const skills = dollInfo ? getSortedUsableSkills(dollInfo) : [];

	return (
		<div
			class={`doll-row is-idle rounded-sm bg-[#E6E6E6] p-1 shadow-sm shadow-black/50 ${placed() ? "border-lime-400/40" : "border-zinc-700"}`}
			data-doll-id={props.dollId}>
			{/* Header */}
			<div class="flex flex-col gap-1.5 border-2 border-[#D7D7D7] p-1">
				<div class="drag-grip flex items-center gap-2">
					{/*<div class="w-4">
						<Grip fill="#1C2A32" />
					</div>*/}
					<div class="flex flex-col gap-0.5">
						<Show when={state.tabData[state.currentTab]?.actionOrder?.indexOf(props.dollId) !== 0}>
							<UpButton dollId={props.dollId} />
						</Show>
						<Show
							when={
								state.tabData[state.currentTab]?.actionOrder?.indexOf(props.dollId) !==
								state.tabData[state.currentTab]?.actionOrder?.length - 1
							}>
							<DownButton dollId={props.dollId} />
						</Show>
					</div>
					<SquareDollChip target={dollInfo!} doll={getDollFromSummon(dollInfo!)} icon={true} name={true} />
					<div class="min-w-0 flex-1">
						{/* Action badges */}
						<div class="mt-1 flex flex-wrap gap-1">
							<For each={actions()}>
								{(action, ai) => (
									<div class="group relative">
										<div
											onClick={() => {
												removeAction(props.dollId, ai());
											}}
											class="drag-ignore cursor-pointer rounded-sm bg-[#384B53] px-1 py-0.5 text-[13px] font-bold tracking-wide text-[#EFEFEF] shadow-sm shadow-black/50 hover:bg-red-900 hover:text-red-300"
											title="Remove"
											data-action-idx={ai()}>
											{renderAction(props.dollId, action)}
										</div>
									</div>
								)}
							</For>
						</div>
					</div>
				</div>

				{/* Skill icons */}
				<div class="flex flex-wrap gap-1.5">
					<For each={skills}>
						{(skill, idx) => <SkillIcon skill={skill} onClick={() => handleSkillClick(props.dollId, idx())} />}
					</For>
				</div>
			</div>
		</div>
	);
}

export default function ActionSidebar(props: { active: boolean }) {
	const actionOrder = createMemo(() => {
		if (state.currentTab < 0 || state.currentTab > 7) return [];
		return state.tabData[state.currentTab]?.actionOrder ?? [];
	});

	return (
		<div class={`flex flex-col gap-1.5 overflow-y-auto p-1 ${props.active ? "" : "hidden"}`}>
			<For each={actionOrder()}>{(dollId, i) => <DollRow dollId={dollId} index={i()} />}</For>
		</div>
	);
}
