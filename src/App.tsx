import { Show, createEffect, onCleanup, onMount } from "solid-js";

import TabBar from "./components/TabBar";
import ArenaCanvas from "./components/ArenaCanvas";
import EditorView, { editorRender } from "./components/EditorView";
import SummaryView from "./components/SummaryView";
import DollSelectorModal from "./components/modals/DollSelectorModal";
import ImportModal from "./components/modals/ImportModal";
import TargetModal from "./components/modals/TargetModal";
import { loadSlots } from "./canvas/editorMap";
import FullScreen from "./components/modals/FullScreen";
import Modal from "./components/modals/Modal";
import ExportModal from "./components/modals/ExportModal";
import SkillDisplayModal from "./components/modals/SkillDisplayModal";
import FormationModal from "./components/modals/FormationModal";
import KeyModal from "./components/modals/KeyModal";
import EffectModal from "./components/modals/EffectModal";
import WeaponModal from "./components/modals/WeaponModal";
import DarkModal from "./components/modals/DarkModal";
import BuffModal from "./components/modals/BuffModal";
import ErrorModal from "./components/modals/ErrorModal";
import IssuesModal from "./components/modals/IssuesModal";
import { trackStore } from "@solid-primitives/deep";
import { loadGameData } from "./store/gameData";
import { prefetchModalImages } from "./store/images";
import {
	compareStateHash,
	importState,
	loadFromLocalStorage,
	loadFromString,
	loadFromWorker,
	loadLocalState,
	saveLocalState,
} from "./store/persistence";
import {
	hideFormationModal,
	importErrors,
	loaded,
	setLoaded,
	setStateFromURL,
	setStateHashMatch,
	showBuffModal,
	showDollModal,
	showEffectModal,
	showExportModal,
	showFormationModal,
	showImportModal,
	showIssuesModal,
	showKeyModal,
	showSkillDisplayModal,
	showTargetModal,
	showWeaponModal,
} from "./store/uiState";
import { localState, state } from "./store/appState";
import { migrate } from "./store/migration";

export default function App() {
	const init = async () => {
		await loadGameData();
		loadSlots();

		migrate();
		loadLocalState();

		const params = new URLSearchParams(window.location.search);
		const stateParam = params.get("state");
		const stateIdParam = params.get("stateId");
		if (stateParam !== null) {
			setStateFromURL(true);
			await importState(loadFromString, stateParam);
		} else if (stateIdParam !== null) {
			setStateFromURL(true);
			await importState(loadFromWorker, stateIdParam);
		} else {
			await importState(loadFromLocalStorage, "");
		}

		setTimeout(() => setLoaded(true), 0);
		prefetchModalImages();
	};
	const updateStateHashMatch = () => {
		setStateHashMatch(compareStateHash());
	};
	onMount(() => {
		void init();
		window.addEventListener("focus", updateStateHashMatch);
	});
	onCleanup(() => {
		window.removeEventListener("focus", updateStateHashMatch);
	});
	// Created synchronously so it is owned by App; waits for init() to finish importing state
	createEffect(() => {
		if (!loaded()) return;
		trackStore(state);
		setTimeout(updateStateHashMatch, 0);
	});
	createEffect(() => {
		if (!loaded()) return;
		trackStore(localState);
		saveLocalState();
	});

	const isEditorTab = () => localState.currentTab === -1;
	const isArenaTab = () => localState.currentTab >= 0 && localState.currentTab <= 7;
	const isSummaryTab = () => localState.currentTab === 8;

	const handleTabChange = (tab: number) => {
		if (tab === -1) {
			// Editor tab - render handled by EditorPanel onMount / effect
			setTimeout(() => {
				editorRender();
			}, 0);
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
			{/* after the export modal, so opening it from there stacks on top */}
			<Show when={showIssuesModal() && loaded()}>
				<FullScreen>
					<Modal width="w-180">
						<IssuesModal />
					</Modal>
				</FullScreen>
			</Show>
			{/* after the issues modal, so opening a doll's equipment from an issue stacks on top */}
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
			<Show when={showEffectModal() && loaded()}>
				<EffectModal />
			</Show>
			{/* not gated on loaded(): import errors happen during init, before it's set */}
			<Show when={importErrors().length}>
				<FullScreen>
					<Modal width="w-140">
						<ErrorModal />
					</Modal>
				</FullScreen>
			</Show>
		</div>
	);
}
