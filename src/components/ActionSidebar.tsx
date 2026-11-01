import { For, Show, createMemo } from "solid-js";
import { produce } from "solid-js/store";
import SkillIcon from "./icons/SkillIcon";
import Alert from "./icons/Alert";
import SquareDollChip from "./SquareDollChip";
import { isPlaced } from "../store/placement";
import { setShowTargetModal, setTargetDollId, setTargetSkillId } from "../store/uiState";
import { endTurnSkill, localState, setState, state } from "../store/appState";
import { renderAction } from "../store/effects";
import { Doll, DollId, Skill, Summon, SummonId } from "../../gfl2-data/types";
import { getActionBarEntities, getSortedUsableSkills, needsAllyTarget } from "../store/gameData";
import { SaveV9Action } from "../types/saves";
import { saveToLocalStorage } from "../store/storage";
import { getActionErrors, isRenderable } from "../store/validation";
import { LocationKey } from "../types/issues";

function handleSkillClick(id: DollId | SummonId, skill: Skill) {
	if (!isPlaced(id)) {
		alert("Place doll first!");
		return;
	}
	if (needsAllyTarget(skill)) {
		setTargetDollId(id);
		setTargetSkillId(skill.id);
		setShowTargetModal(true);
	} else {
		recordSkill(id, [skill.id]);
	}
}

function recordSkill(dollId: string, entry: SaveV9Action) {
	if (localState.currentTab < 0 || localState.currentTab > 7) return;
	setState(
		produce((s) => {
			const tab = s.tabData[localState.currentTab];
			if (!tab.actions[dollId]) tab.actions[dollId] = [];
			tab.actions[dollId].push(entry);
		})
	);
	saveToLocalStorage();
}

function removeAction(dollId: string, actionIdx: number) {
	setState(
		produce((s) => {
			s.tabData[localState.currentTab].actions[dollId]?.splice(actionIdx, 1);
		})
	);
	saveToLocalStorage();
}

/**
 * Swaps two entries of the current turn's action order. The sidebar hides some entries (summons that can't act,
 * entries the checker can't resolve), so rows swap with the next row shown rather than the next entry; hidden ones
 * stay where they are.
 */
function swapInOrder(orderId: DollId | SummonId, neighbourId: DollId | SummonId) {
	setState(
		produce((s) => {
			const order = s.tabData[localState.currentTab].actionOrder;
			const index = order.indexOf(orderId);
			const neighbourIndex = order.indexOf(neighbourId);
			if (index === -1 || neighbourIndex === -1) return;
			order[index] = neighbourId;
			order[neighbourIndex] = orderId;
		})
	);
	saveToLocalStorage();
}

function MoveButton(props: { label: string; orderId: DollId | SummonId; neighbourId: DollId | SummonId }) {
	return (
		<button
			onClick={() => {
				swapInOrder(props.orderId, props.neighbourId);
			}}
			class="cursor-pointer rounded-sm bg-[#384B53] p-0.5 hover:outline-3 hover:outline-white">
			{props.label}
		</button>
	);
}

/** A row of the action bar: the entity shown, and the id it's stored under in the action order (can be an older tier). */
interface ActionRow {
	orderId: DollId | SummonId;
	entity: Doll | Summon;
}

function DollRow(props: { doll: Doll | Summon; orderId: DollId | SummonId; aboveId?: DollId | SummonId; belowId?: DollId | SummonId }) {
	const placed = createMemo(() => isPlaced(props.doll.id));
	const actions = createMemo(() => state.tabData[localState.currentTab]?.actions[props.doll.id] ?? []);
	// End Turn is available to every entity, always last
	const skills = [...getSortedUsableSkills(props.doll), endTurnSkill];

	return (
		<div
			class={`doll-row is-idle rounded-sm bg-[#E6E6E6] p-1 shadow-sm shadow-black/50 ${placed() ? "border-lime-400/40" : "border-zinc-700"}`}
			data-doll-id={props.doll.id}>
			{/* Header */}
			<div class="flex flex-col gap-1.5 border-2 border-[#D7D7D7] p-1">
				<div class="drag-grip flex items-center gap-2">
					{/*<div class="w-4">
						<Grip fill="#1C2A32" />
					</div>*/}
					<div class="flex flex-col gap-0.5">
						<Show when={props.aboveId}>
							{(aboveId) => <MoveButton label="Up" orderId={props.orderId} neighbourId={aboveId()} />}
						</Show>
						<Show when={props.belowId}>
							{(belowId) => <MoveButton label="Down" orderId={props.orderId} neighbourId={belowId()} />}
						</Show>
					</div>
					<SquareDollChip target={props.doll} icon={true} name={true} />
					<div class="min-w-0 flex-1">
						{/* Action badges */}
						<div class="mt-1 flex flex-wrap gap-1">
							<For each={actions()}>
								{(action, ai) => {
									const at = () => ({ tab: localState.currentTab, ownerId: props.doll.id, index: ai() });
									const errors = createMemo(() => getActionErrors(at()));
									return (
										<div class="group relative">
											<div
												onClick={() => {
													removeAction(props.doll.id, ai());
												}}
												class={`drag-ignore cursor-pointer rounded-sm ${errors().length ? "bg-[#ae4749]" : "bg-[#384B53]"} px-1 py-0.5 text-[13px] font-bold tracking-wide text-[#EFEFEF] shadow-sm shadow-black/50 hover:bg-red-900 hover:text-red-300`}
												title={[...errors().map((e) => e.message), "Click to remove"].join("\n")}
												data-action-idx={ai()}>
												<Show when={errors().length}>
													<span class="mr-1 inline-block h-3 w-3 align-[-1px] text-[#F0AF16]">
														<Alert />
													</span>
												</Show>
												{renderAction(action, at())}
											</div>
										</div>
									);
								}}
							</For>
						</div>
					</div>
				</div>

				{/* Skill icons */}
				<div class="flex flex-wrap gap-1.5">
					<For each={skills}>
						{(skill) => (
							<SkillIcon
								skill={skill}
								onClick={() => {
									handleSkillClick(props.doll.id, skill);
								}}
							/>
						)}
					</For>
				</div>
			</div>
		</div>
	);
}

export default function ActionSidebar(props: { active: boolean }) {
	const rows = createMemo((): ActionRow[] => {
		if (localState.currentTab < 0 || localState.currentTab > 7) return [];
		const tab = localState.currentTab;
		const order = state.tabData[tab]?.actionOrder ?? [];
		// one id at a time, so each row keeps the id it's stored under; getActionBarEntities skips hidden summons
		return order.flatMap((orderId, index) => {
			if (!isRenderable({ kind: LocationKey.ActionOrder, tab, index })) return [];
			return getActionBarEntities([orderId]).map((entity) => ({ orderId, entity }));
		});
	});

	return (
		<div class={`flex flex-col gap-1.5 overflow-y-auto p-1 ${props.active ? "" : "hidden"}`}>
			<For each={rows()}>
				{(row, i) => (
					<DollRow
						doll={row.entity}
						orderId={row.orderId}
						aboveId={rows()[i() - 1]?.orderId}
						belowId={rows()[i() + 1]?.orderId}
					/>
				)}
			</For>
		</div>
	);
}
