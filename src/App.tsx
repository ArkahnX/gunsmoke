import { createSignal, Show, onMount } from "solid-js";
import {
	state,
	showDollModal,
	showFortificationModal,
	showImportModal,
	showTargetModal,
	loadFromLocalStorage,
	preloadCanvasImages,
	defaultActionOrder,
	saveToLocalStorage,
	loadCombinedJson,
} from "./store";
import type { RawDollEntry, DollData, SummonData, Skill } from "./types";

import TabBar from "./components/TabBar";
import SetupSidebar from "./components/SetupSidebar";
import ArenaCanvas from "./components/ArenaCanvas";
import EditorView, { editorRender } from "./components/EditorView";
import ActionSidebar from "./components/ActionSidebar";
import SummaryView from "./components/SummaryView";
import DollSelectorModal from "./components/modals/DollSelectorModal";
import FortificationModal from "./components/modals/FortificationModal";
import ImportModal from "./components/modals/ImportModal";
import TargetModal from "./components/modals/TargetModal";
import { loadEditorMap } from "./canvas/editorMap";
import FullScreen from "./components/modals/FullScreen";
import Modal from "./components/modals/Modal";

export default function App() {
	const [coords, setCoords] = createSignal("");
	const [loaded, setLoaded] = createSignal(false);
	const [activeTab, setActiveTab] = createSignal("setup");

	onMount(async () => {
		try {
			await loadCombinedJson();
			loadEditorMap();

			const restored = loadFromLocalStorage();
			if (restored) {
				console.log("Restored state");
				await preloadCanvasImages();
			}
			for (let i = 0; i < 8; i++) defaultActionOrder(i);
			if (!restored) saveToLocalStorage();

			setLoaded(true);

			// Initial draw happens via ArenaCanvas onMount
		} catch (e) {
			console.error("Please let ArkahnX know about the following error");
			console.error(e);
			alert("potentially uncaught error encountered - check console for details");
		}
	});

	const isSetupTab = () => activeTab() === "setup" || state.currentTab === 0;
	const isActionTab = () => activeTab() === "actions" && state.currentTab > 0;

	const isEditorTab = () => state.currentTab === -1;
	const isArenaTab = () => state.currentTab >= 0 && state.currentTab <= 7;
	const isSummaryTab = () => state.currentTab === 8;
	const showSidebars = () => state.currentTab > 0 && state.currentTab < 8;
	// TODO show left sidebar during setup, show right sidebar during arena, show export and import during summary

	const handleTabChange = (tab: number) => {
		if (tab === -1) {
			// Editor tab - render handled by EditorPanel onMount / effect
			setTimeout(() => editorRender(), 0);
		}
	};

	return (
		<div class="flex h-screen flex-col bg-zinc-950 text-white">
			{/* TOP TABS */}
			<TabBar onTabChange={handleTabChange} />

			<div class="relative flex-1 overflow-hidden" id="body">
				{/* ARENA CANVAS */}
				<Show when={isArenaTab() && loaded()}>
					<div class="absolute right-0 left-0 flex items-center justify-center bg-zinc-950">
						<ArenaCanvas
							onCoordsChange={setCoords}
							onMouseUp={() => {
								/* character panel updates reactively */
							}}
						/>
					</div>
					{/* Coords overlay */}
					<div class="pointer-events-none absolute bottom-6 left-1/2 -translate-x-1/2 rounded-3xl bg-black/80 px-4 py-1.5 font-mono text-xs text-lime-400">
						{coords() || "00,00"}
					</div>
				</Show>
				<Show when={isArenaTab() && loaded()}>
					<div class="absolute top-3.75 bottom-3.75 left-3.75 z-10 flex">
						<Modal width="w-96">
							<div class="flex gap-1 px-3 pb-1.75">
								<button
									onClick={() => {
										setActiveTab("setup");
									}}
									class={`flex h-13 flex-1 items-center justify-center gap-1 rounded-t-sm border-b-4 px-1 pt-3 pb-2 text-2xl font-bold transition-all ${
										isSetupTab()
											? "border-[#F0AF16] bg-[#384B53] text-[#EFEFEF] shadow-xl/20"
											: "border-[#8F9094] bg-[#A8A9AE] text-[#384B53] hover:border-[#606164]"
									}`}>
									<span>Setup</span>
								</button>
								<button
									onClick={() => {
										setActiveTab("actions");
									}}
									class={`flex h-13 flex-1 items-center justify-center gap-1 rounded-t-sm border-b-4 px-1 pt-3 pb-2 text-2xl font-bold transition-all ${
										isActionTab()
											? "border-[#F0AF16] bg-[#384B53] text-[#EFEFEF] shadow-xl/20"
											: "border-[#8F9094] bg-[#A8A9AE] text-[#384B53] hover:border-[#606164]"
									} ${state.currentTab === 0 ? "cursor-not-allowed opacity-50" : ""}`}>
									<span>Doll Actions</span>
								</button>
							</div>
							<SetupSidebar active={isSetupTab()} />
							<ActionSidebar active={isActionTab()} />
						</Modal>
					</div>
				</Show>

				{/* EDITOR PANEL */}
				<Show when={isEditorTab() && loaded()}>
					<EditorView />
				</Show>

				{/* SUMMARY VIEW */}
				<Show when={isSummaryTab() && loaded()}>
					<SummaryView />
				</Show>
			</div>

			{/* MODALS */}
			<Show when={showDollModal() && loaded()}>
				<FullScreen>
					<Modal>
						<DollSelectorModal />
					</Modal>
				</FullScreen>
			</Show>
			<Show when={showFortificationModal() && loaded()}>
				<FullScreen>
					<Modal width="w-[420px]">
						<FortificationModal />
					</Modal>
				</FullScreen>
			</Show>
			<Show when={showImportModal() && loaded()}>
				<FullScreen>
					<Modal width="w-140">
						<ImportModal />
					</Modal>
				</FullScreen>
			</Show>
			<Show when={showTargetModal() && loaded()}>
				<TargetModal />
			</Show>
		</div>
	);
}
