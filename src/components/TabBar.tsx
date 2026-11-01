import { createMemo, For, Show } from "solid-js";
import { produce } from "solid-js/store";
import { TabBarProps } from "../types";
import Button from "./buttons/Button";
import {
	loaded,
	setShowExportModal,
	setShowImportModal,
	setShowIssuesModal,
	setShowSkillDisplayModal,
	stateFromURL,
	stateHashMatch,
} from "../store/uiState";
import { localState, setLocalState, setState } from "../store/appState";
import { interactiveStyles } from "../store/effects";
import { saveToLocalStorage } from "../store/storage";
import { saveIssueGroups } from "../store/validation";

export default function TabBar(props: TabBarProps) {
	const savedState = "The current state is saved locally.";
	const urlState = "The current state is derived from the URL. Make a change to save it locally.";
	const unsavedState = "The current state is unsaved. Make a change to save it locally.";
	const stateStyle = createMemo(() => {
		if (stateFromURL()) return { color: "bg-[#F0AF16]", text: urlState };
		if (stateHashMatch()) return { color: "bg-[#2dd4bf]", text: savedState };
		return { color: "bg-[#AE4749]", text: unsavedState };
	});
	const switchToTab = (newTab: number) => {
		setLocalState(
			produce((s) => {
				s.currentTab = newTab;
			})
		);
		props.onTabChange(newTab);
	};
	const isActionTab = createMemo(() => localState.currentTab >= 1 && localState.currentTab <= 7);
	const copyPreviousPlacements = () => {
		if (localState.currentTab <= 0) {
			alert("No previous tab!");
			return;
		}
		const prev = localState.currentTab - 1;
		setState(
			produce((s) => {
				const curTab = s.tabData[localState.currentTab];
				const prevTab = s.tabData[prev];
				for (const doll of s.selectedDolls) {
					curTab.dollPositions[doll.id] = { x: -1, y: -1 };
					prevTab.dollPositions[doll.id] = prevTab.dollPositions[doll.id] ?? { x: -1, y: -1 };
					curTab.dollPositions[doll.id].x = prevTab.dollPositions[doll.id].x;
					curTab.dollPositions[doll.id].y = prevTab.dollPositions[doll.id].y;
				}
				curTab.summonPositions = prevTab.summonPositions.map((p) => ({ ...p }));
			})
		);
		saveToLocalStorage();
	};

	return (
		<div class="flex items-center justify-between gap-1 overflow-x-auto border-t border-[#E06C28] bg-[#C7C5CE] px-4 py-2">
			<div class="flex gap-3">
				{/* Editor tab */}
				<button
					onClick={() => {
						switchToTab(-1);
					}}
					class={`flex h-13 flex-1 cursor-pointer items-center justify-center gap-1 rounded-t-sm border-b-4 px-3 pt-3 pb-2 text-2xl font-bold whitespace-nowrap transition-all ${
						localState.currentTab === -1
							? "border-[#F26C1C] bg-[#384B53] text-[#EFEFEF] shadow-xl/20"
							: "border-[#8F9094] bg-[#A8A9AE] text-[#384B53] hover:border-[#606164]"
					}`}>
					Map Editor
				</button>

				{/* Separator */}
				<div class="mx-1 h-6 w-px self-center bg-zinc-700" />

				{/* Arena tabs 0-7 */}
				<div class="flex gap-0">
					<For each={Array.from({ length: 8 }, (_, i) => i)}>
						{(i) => (
							<button
								onClick={() => {
									switchToTab(i);
								}}
								class={`flex h-13 flex-1 cursor-pointer items-center justify-center gap-1 rounded-t-sm border-b-4 px-3 pt-3 pb-2 text-2xl font-bold transition-all ${
									localState.currentTab === i
										? "border-[#F26C1C] bg-[#384B53] text-[#EFEFEF] shadow-xl/20"
										: "border-[#8F9094] bg-transparent text-[#384B53] hover:border-[#606164]"
								}`}>
								{i === 0 ? "Setup" : i}
							</button>
						)}
					</For>
				</div>
				{/* Summary */}
				<button
					onClick={() => {
						switchToTab(8);
					}}
					class={`flex h-13 flex-1 cursor-pointer items-center justify-center gap-1 rounded-t-sm border-b-4 px-3 pt-3 pb-2 text-2xl font-bold transition-all ${
						localState.currentTab === 8
							? "border-[#F26C1C] bg-[#384B53] text-[#EFEFEF] shadow-xl/20"
							: "border-[#8F9094] bg-transparent text-[#384B53] hover:border-[#606164]"
					}`}>
					Summary
				</button>
			</div>
			<div class="flex flex-row items-center gap-2">
				<Show when={localState.currentTab === 8}>
					<div class="flex flex-row gap-1.5 p-1">
						<Button onClick={() => setShowExportModal(true)} color="dark" design="custom" content="Export / Share" />
						<Button onClick={() => setShowImportModal(true)} color="dark" design="custom" content="Import Transcript" />
						<Button onClick={() => setShowSkillDisplayModal(true)} color="dark" design="custom" content="Options" />
					</div>
				</Show>
				<Show when={isActionTab()}>
					<Button onClick={copyPreviousPlacements} color="dark" design="custom" content="Use Previous Turn Positions" />
				</Show>
				{/* loaded() first: the timeline isn't validated until the game data and save are in */}
				<Show when={loaded() && saveIssueGroups().length}>
					<Button
						onClick={() => setShowIssuesModal(true)}
						color="red"
						design="custom"
						content="Fix Issues"
						badge={saveIssueGroups().length}
					/>
				</Show>
				<div class={`${interactiveStyles(false)} h-6 w-6 rounded-full ${stateStyle().color}`} title={stateStyle().text}></div>
			</div>
		</div>
	);
}
