import { Show, onMount } from "solid-js";
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
	showExportModal,
	loadCombinedJson,
	loadFromURL,
	setLoaded,
	loaded,
	showSkillDisplayModal,
	setOverrideSkillNotations,
	overrideSkillDisplay,
} from "./store";
import type { SkillDisplay } from "./types";

import TabBar from "./components/TabBar";
import ArenaCanvas from "./components/ArenaCanvas";
import EditorView, { editorRender } from "./components/EditorView";
import SummaryView from "./components/SummaryView";
import DollSelectorModal from "./components/modals/DollSelectorModal";
import FortificationModal from "./components/modals/FortificationModal";
import ImportModal from "./components/modals/ImportModal";
import TargetModal from "./components/modals/TargetModal";
import { loadEditorMap } from "./canvas/editorMap";
import FullScreen from "./components/modals/FullScreen";
import Modal from "./components/modals/Modal";
import ExportModal from "./components/modals/ExportModal";
import SkillDisplayModal from "./components/modals/SkillDisplayModal";
import { SKILL_DISPLAY_KEY } from "./types/constants";

export default function App() {
	onMount(async () => {
		try {
			await loadCombinedJson();
			loadEditorMap();

			const params = new URLSearchParams(window.location.search);
			let restored = false;
			if (params.has("state")) {
				restored = await loadFromURL();
			} else {
				restored = loadFromLocalStorage();
			}
			if (restored) {
				console.log("Restored state");
				await preloadCanvasImages();
			}
			for (let i = 0; i < 8; i++) defaultActionOrder(i);
			if (!restored) saveToLocalStorage();

			const saved = localStorage.getItem(SKILL_DISPLAY_KEY);
			if (saved) {
				const data: SkillDisplay = JSON.parse(saved);
				setOverrideSkillNotations(data.override);
				if (data.override === true) {
					overrideSkillDisplay(data.skillDisplay);
				}
			}

			setLoaded(true);
			// Initial draw happens via ArenaCanvas onMount
		} catch (e) {
			console.error("Please let ArkahnX know about the following error");
			console.error(e);
			alert("potentially uncaught error encountered - check console for details");
		}
	});

	const isEditorTab = () => state.currentTab === -1;
	const isArenaTab = () => state.currentTab >= 0 && state.currentTab <= 7;
	const isSummaryTab = () => state.currentTab === 8;
	const showSidebars = () => state.currentTab > 0 && state.currentTab < 8;

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
					<ArenaCanvas />
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
			<Show when={showExportModal() && loaded()}>
				<FullScreen>
					<Modal width="w-140">
						<ExportModal />
					</Modal>
				</FullScreen>
			</Show>
			<Show when={showSkillDisplayModal() && loaded()}>
				<FullScreen>
					<Modal width="w-96">
						<SkillDisplayModal />
					</Modal>
				</FullScreen>
			</Show>
			<Show when={showTargetModal() && loaded()}>
				<TargetModal />
			</Show>
		</div>
	);
}
