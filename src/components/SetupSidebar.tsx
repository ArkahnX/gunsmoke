import { For, Show, createMemo, createSignal } from "solid-js";
import { currentMapLabel, isBuiltInMap, mapChoices, selectMap, timelineSlot } from "../canvas/editorMap";
import { produce } from "solid-js/store";
import Button from "./buttons/Button";
import SmallDollChip from "./SmallDollChip";
import Alert from "./icons/Alert";
import { deployFromSetupPanel } from "./ArenaCanvas";
import ConfirmModal from "./modals/ConfirmModal";
import CustomMapModal from "./modals/CustomMapModal";
import Dropdown from "./Dropdown";
import { localState, nextSummonInstanceId, setState, state } from "../store/appState";
import { getSelectedDoll, getSummonsFromSelectedDolls, SetupSummon } from "../store/gameData";
import { defaultActionOrder, openFormation, setupTempSelectedDolls } from "../store/dollSelection";
import {
	setActivePhaseTab,
	setDollFortification,
	setShowBuffModal,
	setShowDollModal,
	setShowExportModal,
	setShowImportModal,
	setShowSkillDisplayModal,
} from "../store/uiState";
import { resetToDefaultState } from "../store/persistence";
import { Phase } from "../../gfl2-data/enums";
import { saveToLocalStorage } from "../store/storage";
import { keyName } from "../store/validation";
import { KeyId } from "../../gfl2-data/types";
import { SaveV9SelectedDoll } from "../types/saves";

const needsText = (owner: SaveV9SelectedDoll, missingKey: KeyId) => `Needs ${getSelectedDoll(owner).name} to equip ${keyName(missingKey)}`;
// a summon a key would unlock: placeable anyway (and reported as an issue) when every skill and summon is shown
const canPlaceLocked = () => localState.alwaysDisplaySkills;
const lockedConsequence = (subject = "it") =>
	canPlaceLocked() ? "" : `To place ${subject} anyway, set "Show all skills and summons" to "always" in Options.`;

/** A summon to drag onto the map; greyed out and not draggable while its key is missing, unless that's allowed. */
function SummonChip(props: SetupSummon) {
	const needs = props.missingKey && needsText(props.owner, props.missingKey);
	const deployable = () => !props.missingKey || canPlaceLocked();
	return (
		<div title={needs ? `${needs}. ${lockedConsequence()}` : undefined}>
			<Show when={deployable()} fallback={<SmallDollChip target={props.summon} alert dimmed />}>
				<SmallDollChip
					target={props.summon}
					alert={!!props.missingKey}
					onDragStart={(e) => {
						e.preventDefault();
					}}
					onPointerDown={(e) => {
						e.preventDefault();
						deployFromSetupPanel(props.summon.id, nextSummonInstanceId(state.tabData), e);
					}}
				/>
			</Show>
		</div>
	);
}

export default function SetupSidebar(props: { active: boolean }) {
	const isActionTab = createMemo(() => localState.currentTab >= 1 && localState.currentTab <= 7);

	const availableSummons = createMemo(() => (isActionTab() ? getSummonsFromSelectedDolls(state.selectedDolls) : []));
	/** Summons whose owner is missing a key, grouped by that key so summons sharing one are listed under it once. */
	const lockedByKey = createMemo(() => {
		const groups = new Map<string, { owner: SaveV9SelectedDoll; keyId: KeyId; summons: SetupSummon[] }>();
		for (const setupSummon of availableSummons()) {
			const { owner, missingKey } = setupSummon;
			if (!missingKey) continue;
			const id = `${owner.id}:${missingKey}`;
			const group = groups.get(id) ?? { owner, keyId: missingKey, summons: [] };
			group.summons.push(setupSummon);
			groups.set(id, group);
		}
		return [...groups.values()];
	});
	const lockedCount = () => lockedByKey().reduce((count, group) => count + group.summons.length, 0);

	const [showClearSkillModal, setShowClearSkillModal] = createSignal(false);
	const [showClearTurnModal, setShowClearTurnModal] = createSignal(false);
	const [showClearDataModal, setShowClearDataModal] = createSignal(false);
	const [customMapModal, setCustomMapModal] = createSignal<"import" | "save" | null>(null);
	const choices = createMemo(() => mapChoices());
	// a custom map that came with the timeline (e.g. a shared link) and isn't in any local slot
	const unsavedMap = () => !isBuiltInMap(state.map) && state.customMap !== undefined && timelineSlot() === -1;

	const openDollSelector = () => {
		setupTempSelectedDolls();
		// Seed dollNumbers with current fortifications
		const nums: Record<string, number> = {};
		state.selectedDolls.forEach((d) => {
			nums[d.id] = d.fortification;
		});
		setDollFortification(nums);
		setActivePhaseTab(Phase.All);
		setShowDollModal(true);
	};

	const clearCurrentTurn = () => {
		if (localState.currentTab === -1) return;
		setState(
			produce((s) => {
				const tab = s.tabData[localState.currentTab];
				tab.actionOrder.length = 0;
				tab.summonPositions.length = 0;
				tab.dollPositions = {};
				tab.actions = {};
				for (const doll of s.selectedDolls) {
					tab.dollPositions[doll.id] = { x: -1, y: -1 };
					tab.actions[doll.id] = [];
					const dollInfo = getSelectedDoll(doll);
					for (const summon of dollInfo.summons) tab.actions[summon.id] = [];
				}
			})
		);
		defaultActionOrder(localState.currentTab);
		saveToLocalStorage();
	};

	const clearSavedData = () => {
		resetToDefaultState();
		location.reload();
	};

	const clearSkills = () => {
		if (localState.currentTab < 0 || localState.currentTab > 7) return;
		setState(
			produce((s) => {
				const tab = s.tabData[localState.currentTab];
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
				<Dropdown
					options={choices().map((choice) => choice.label)}
					value={currentMapLabel()}
					onChange={(value) => {
						const choice = choices().find((c) => c.label === value);
						if (!choice) return;
						selectMap(choice.map);
						saveToLocalStorage();
					}}
				/>
				<div class="flex flex-row gap-2">
					<Button color="dark" onClick={() => setCustomMapModal("import")} design="custom" content="Import Custom Map" />
					<Show when={unsavedMap()}>
						<Button color="dark" onClick={() => setCustomMapModal("save")} design="custom" content="Save to Slot" />
					</Show>
				</div>
				<Show when={customMapModal()}>
					{(mode) => <CustomMapModal mode={mode()} onClose={() => setCustomMapModal(null)} />}
				</Show>
				<div class="flex flex-row gap-2">
					<Button color="dark" onClick={openDollSelector} design="custom" content="Select Dolls" />
					<Button color="dark" onClick={openFormation} design="custom" content="Change Equip" />
				</div>
				<Button color="dark" onClick={() => setShowBuffModal(true)} design="custom" content="Select Support Buff" />
				<div class="text-md mx-3 flex h-10 items-center justify-center self-stretch bg-[#384B53] font-bold tracking-wide text-[#ECECEC]">
					Echelon (drag to map)
				</div>
				<div class="flex flex-wrap gap-3">
					<For each={state.selectedDolls}>
						{(doll) => {
							const dollInfo = getSelectedDoll(doll);
							if (!dollInfo) return null;
							return (
								<SmallDollChip
									target={dollInfo}
									onDragStart={(e) => {
										e.preventDefault();
									}}
									onPointerDown={(e) => {
										e.preventDefault();
										deployFromSetupPanel(doll.id, null, e);
									}}
								/>
							);
						}}
					</For>
				</div>

				{/* Summons section */}
				<Show when={isActionTab() && availableSummons().length > 0}>
					<div class="text-md mx-3 flex h-10 items-center justify-center self-stretch bg-[#384B53] font-bold tracking-wide text-[#ECECEC]">
						Summons (drag to map)
					</div>
					<div class="flex flex-wrap gap-3">
						<For each={availableSummons()}>{(availableSummon) => <SummonChip {...availableSummon} />}</For>
					</div>
					{/* summons waiting on their doll's equipment, kept apart with the reason in view rather than in a hover */}
					<Show when={lockedByKey().length > 0}>
						<div class="mx-3 flex flex-col gap-2 self-stretch bg-[#2A3D46] p-2 text-xs font-normal text-[#C9C8CE]">
							<div class="flex items-center gap-1.5 font-bold text-[#EFEFEF]">
								<span class="gf-badge gf-badge-missing h-4 w-4 shrink-0">
									<Alert />
								</span>
								Missing required keys
							</div>
							<Show when={lockedConsequence()}>
								<div class="text-[#9AA3A8]">{lockedConsequence(lockedCount() > 1 ? "them" : "it")}</div>
							</Show>
						</div>
					</Show>
				</Show>

				{/* Action buttons */}
				<div class="text-md mx-3 flex h-10 items-center justify-center self-stretch bg-[#384B53] font-bold tracking-wide text-[#ECECEC]">
					State Management
				</div>
				<Button onClick={() => setShowSkillDisplayModal(true)} color="dark" design="custom" content="Options" />
				<Button onClick={() => setShowExportModal(true)} color="dark" design="custom" content="Export / Share" />
				<Button onClick={() => setShowImportModal(true)} color="dark" design="custom" content="Import Transcript" />
				<div class="text-md mx-3 flex h-10 items-center justify-center self-stretch bg-[#AE4749] font-bold tracking-wide text-[#ECECEC]">
					Danger Zone
				</div>
				<Button onClick={() => setShowClearSkillModal(true)} color="red" design="custom" content="Clear Skills This Turn" />
				<ConfirmModal
					mount={document.querySelector("#body") ?? document.body}
					title="Caution"
					content="Clear all skill usage for current turn?"
					isActive={showClearSkillModal}
					setActive={setShowClearSkillModal}
					onClick={clearSkills}
				/>
				<Button onClick={() => setShowClearTurnModal(true)} color="red" design="custom" content="Clear This Entire Turn" />
				<ConfirmModal
					mount={document.querySelector("#body") ?? document.body}
					title="Caution"
					content="Clear all skill usage and doll positions for current turn?"
					isActive={showClearTurnModal}
					setActive={setShowClearTurnModal}
					onClick={clearCurrentTurn}
				/>
				<Button onClick={() => setShowClearDataModal(true)} color="red" design="custom" content="Clear All Turns" />
				<ConfirmModal
					mount={document.querySelector("#body") ?? document.body}
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
