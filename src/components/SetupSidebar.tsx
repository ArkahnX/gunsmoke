import { For, Show, createMemo, createSignal } from "solid-js";
import {
	state,
	setState,
	getSummonIdsFromDollIds,
	setShowDollModal,
	setShowImportModal,
	setTempSelected,
	setDollFortification,
	setActivePhaseTab,
	saveToLocalStorage,
	defaultActionOrder,
	getDollFromSummon,
	updateSkillDisplay,
	setShowExportModal,
	getDollFromId,
	getSummonFromId,
	setShowSkillDisplayModal,
} from "../store";
import { STORAGE_KEY } from "../types/constants";
import { editorResetLayout } from "../canvas/editorMap";
import { produce } from "solid-js/store";
import Button from "./buttons/Button";
import SmallDollChip from "./SmallDollChip";
import { beginExternalDrag } from "./ArenaCanvas";
import ConfirmModal from "./modals/ConfirmModal";
import ContentModal from "./modals/ContentModal";

export default function SetupSidebar(props: { active: boolean }) {
	const isActionTab = createMemo(() => state.currentTab >= 1 && state.currentTab <= 7);

	const availableSummonIds = createMemo(() => (isActionTab() ? getSummonIdsFromDollIds(state.selectedDolls.map((d) => d.id)) : []));

	const [showClearSkillModal, setShowClearSkillModal] = createSignal(false);
	const [showClearTurnModal, setShowClearTurnModal] = createSignal(false);
	const [showClearDataModal, setShowClearDataModal] = createSignal(false);

	const openDollSelector = () => {
		setTempSelected(state.selectedDolls.map((d) => d.id));
		// Seed dollNumbers with current fortifications
		const nums: Record<string, number> = {};
		state.selectedDolls.forEach((d) => {
			nums[d.id] = d.fortification;
		});
		setDollFortification(nums);
		setActivePhaseTab("All");
		setShowDollModal(true);
	};

	const copyPreviousPlacements = () => {
		if (state.currentTab <= 0) {
			alert("No previous tab!");
			return;
		}
		const prev = state.currentTab - 1;
		setState(
			produce((s) => {
				const curTab = s.tabData[s.currentTab]!;
				const prevTab = s.tabData[prev]!;
				for (const doll of s.selectedDolls) {
					curTab.dollPositions[doll.id] = { x: -1, y: -1 };
					prevTab.dollPositions[doll.id] = prevTab.dollPositions[doll.id] ?? { x: -1, y: -1 };
					curTab.dollPositions[doll.id]!.x = prevTab.dollPositions[doll.id]!.x;
					curTab.dollPositions[doll.id]!.y = prevTab.dollPositions[doll.id]!.y;
				}
				curTab.summonPositions = prevTab.summonPositions.map((p) => ({ ...p }));
			})
		);
		saveToLocalStorage();
	};

	const clearCurrentTurn = () => {
		if (state.currentTab === -1) {
			editorResetLayout();
			return;
		}
		setState(
			produce((s) => {
				const tab = s.tabData[s.currentTab]!;
				tab.actionOrder.length = 0;
				tab.summonPositions.length = 0;
				tab.dollPositions = {};
				tab.actions = {};
				for (const doll of s.selectedDolls) {
					tab.dollPositions[doll.id] = { x: -1, y: -1 };
					tab.actions[doll.id] = [];
					const dollInfo = getDollFromId(doll.id);
					if (dollInfo && dollInfo?.hasSummons) {
						for (const summonId of dollInfo.summons) tab.actions[summonId] = [];
					}
				}
			})
		);
		defaultActionOrder(state.currentTab);
		saveToLocalStorage();
	};

	const clearSavedData = () => {
		localStorage.removeItem(STORAGE_KEY);
		location.reload();
	};

	const clearSkills = () => {
		if (state.currentTab < 0 || state.currentTab > 7) return;
		setState(
			produce((s) => {
				const tab = s.tabData[s.currentTab]!;
				for (const dollId of Object.keys(tab.actions)) {
					tab.actions[dollId] = [];
				}
			})
		);
		saveToLocalStorage();
	};

	return (
		<div class={`${props.active ? "" : "hidden"} overflow-y-auto`}>
			<div class="flex flex-col items-center gap-3 pt-1 text-sm font-bold text-[#384B53]">
				<Button color="dark" onClick={openDollSelector} design="custom" content="Select Dolls" />
				<Show when={isActionTab()}>
					<Button color="dark" onClick={copyPreviousPlacements} design="custom" content="Use Prev Turn Positions" />
				</Show>
				<div class="text-md mx-3 flex h-10 items-center justify-center self-stretch bg-[#384B53] font-bold tracking-wide text-[#ECECEC]">
					Echelon (drag to map)
				</div>
				<div class="flex flex-wrap gap-3">
					<For each={state.selectedDolls}>
						{(doll) => {
							const dollInfo = getDollFromId(doll.id);
							if (!dollInfo) return null;
							return (
								<SmallDollChip
									target={dollInfo}
									doll={dollInfo}
									onDragStart={(e) => e.preventDefault()}
									onMouseDown={(e) => {
										e.preventDefault();
										beginExternalDrag(doll.id, null, e as MouseEvent);
									}}
									onTouchStart={(e) => {
										e.preventDefault();
										beginExternalDrag(doll.id, null, e as TouchEvent);
									}}
								/>
							);
						}}
					</For>
				</div>

				{/* Summons section */}
				<Show when={isActionTab() && availableSummonIds().length > 0}>
					<div class="text-md mx-3 flex h-10 items-center justify-center self-stretch bg-[#384B53] font-bold tracking-wide text-[#ECECEC]">
						Summons (drag to map)
					</div>
					<div class="flex flex-wrap gap-3">
						<For each={availableSummonIds()}>
							{(summonId) => {
								const summonInfo = getSummonFromId(summonId);
								if (!summonInfo) return null;
								return (
									<SmallDollChip
										target={summonInfo}
										doll={getDollFromSummon(summonInfo)}
										onDragStart={(e) => e.preventDefault()}
										onMouseDown={(e) => {
											e.preventDefault();
											beginExternalDrag(
												summonId,
												`s${state.tabData[state.currentTab]!.summonPositions.length}`,
												e as MouseEvent
											);
										}}
										onTouchStart={(e) => {
											e.preventDefault();
											beginExternalDrag(
												summonId,
												`s${state.tabData[state.currentTab]!.summonPositions.length}`,
												e as TouchEvent
											);
										}}
									/>
								);
							}}
						</For>
					</div>
				</Show>

				{/* Action buttons */}
				<div class="text-md mx-3 flex h-10 items-center justify-center self-stretch bg-[#384B53] font-bold tracking-wide text-[#ECECEC]">
					State Management
				</div>
				<Button onClick={() => setShowSkillDisplayModal(true)} color="dark" design="custom" content="Set Skill Display" />
				<Button onClick={() => setShowExportModal(true)} color="dark" design="custom" content="Export Transcript" />
				<Button onClick={() => setShowImportModal(true)} color="dark" design="custom" content="Import Transcript" />
				<div class="text-md mx-3 flex h-10 items-center justify-center self-stretch bg-[#AE4749] font-bold tracking-wide text-[#ECECEC]">
					Danger Zone
				</div>
				<Button onClick={() => setShowClearSkillModal(true)} color="red" design="custom" content="Clear Skills This Turn" />
				<ConfirmModal
					mount={document.querySelector("#body")!}
					title="Caution"
					content="Clear all skill usage for current turn?"
					isActive={showClearSkillModal}
					setActive={setShowClearSkillModal}
					onClick={clearSkills}
				/>
				<Button onClick={() => setShowClearTurnModal(true)} color="red" design="custom" content="Clear This Entire Turn" />
				<ConfirmModal
					mount={document.querySelector("#body")!}
					title="Caution"
					content="Clear all skill usage and doll positions for current turn?"
					isActive={showClearTurnModal}
					setActive={setShowClearTurnModal}
					onClick={clearCurrentTurn}
				/>
				<Button onClick={() => setShowClearDataModal(true)} color="red" design="custom" content="Clear All Turns" />
				<ConfirmModal
					mount={document.querySelector("#body")!}
					title="Caution"
					content="Clear all stored data for all turns?"
					isActive={showClearDataModal}
					setActive={setShowClearDataModal}
					onClick={clearSavedData}
				/>
			</div>
		</div>
	);
}
