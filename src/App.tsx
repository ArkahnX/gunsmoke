import { Show, createEffect, onMount } from "solid-js";
import {
	state,
	showDollModal,
	showImportModal,
	showTargetModal,
	loadFromLocalStorage,
	showExportModal,
	loadCombinedJson,
	setLoaded,
	loaded,
	showSkillDisplayModal,
	showFormationModal,
	hideFormationModal,
	showKeyModal,
	showWeaponModal,
	importState,
	loadFromString,
	migrate,
	showBuffModal,
	setStateHashMatch,
	compareStateHash,
	setStateFromURL,
	loadFromWorker,
} from "./store";

import TabBar from "./components/TabBar";
import ArenaCanvas from "./components/ArenaCanvas";
import EditorView, { editorRender } from "./components/EditorView";
import SummaryView from "./components/SummaryView";
import DollSelectorModal from "./components/modals/DollSelectorModal";
import ImportModal from "./components/modals/ImportModal";
import TargetModal from "./components/modals/TargetModal";
import { loadEditorMap } from "./canvas/editorMap";
import FullScreen from "./components/modals/FullScreen";
import Modal from "./components/modals/Modal";
import ExportModal from "./components/modals/ExportModal";
import SkillDisplayModal from "./components/modals/SkillDisplayModal";
import FormationModal from "./components/modals/FormationModal";
import KeyModal from "./components/modals/KeyModal";
import WeaponModal from "./components/modals/WeaponModal";
import DarkModal from "./components/modals/DarkModal";
import BuffModal from "./components/modals/BuffModal";
import { trackStore } from "@solid-primitives/deep";

export default function App() {
	onMount(async () => {
		await loadCombinedJson();
		loadEditorMap();

		migrate();
		const params = new URLSearchParams(window.location.search);
		if (params.has("state")) {
			setStateFromURL(true);
			await importState(loadFromString, params.get("state")!);
		} else if (params.has("stateId")) {
			setStateFromURL(true);
			await importState(loadFromWorker, params.get("stateId")!);
		} else {
			await importState(loadFromLocalStorage, "");
		}

		setTimeout(() => setLoaded(true), 0);
		window.addEventListener("focus", function (e) {
			setStateHashMatch(compareStateHash(state));
		});
		createEffect(() => {
			trackStore(state);
			setTimeout(() => {
				setStateHashMatch(compareStateHash(state));
			}, 0);
		});
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
			<Show when={showFormationModal() && loaded()}>
				<FullScreen>
					<DarkModal hide={hideFormationModal()} width="w-[988px]">
						<FormationModal />
					</DarkModal>
					<Show when={showKeyModal() && loaded()}>
						<DarkModal>
							<KeyModal />
						</DarkModal>
					</Show>
					<Show when={showWeaponModal() && loaded()}>
						<Modal>
							<WeaponModal />
						</Modal>
					</Show>
				</FullScreen>
			</Show>
			<Show when={showBuffModal() && loaded()}>
				<FullScreen>
					<Modal>
						<BuffModal />
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
					<Modal width="w-[460px]">
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
