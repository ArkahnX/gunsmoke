import { createSignal, For, Show } from "solid-js";
import { Portal } from "solid-js/web";
import Button from "../buttons/Button";
import ConfirmModal from "./ConfirmModal";
import FullScreen from "./FullScreen";
import Modal from "./Modal";
import ModalFooter from "./ModalFooter";
import ModalHeader from "./ModalHeader";
import { parseMapJson, saveSlot, selectMap, slots, toPlainMap, uniqueMapName } from "../../canvas/editorMap";
import { state } from "../../store/appState";
import { saveToLocalStorage } from "../../store/storage";
import { MapGrid } from "../../types";
import { MAP_SLOT_COUNT } from "../../types/constants";

/**
 * Puts a custom map into a slot and makes the timeline use it: either pasted JSON ("import"), or the timeline's own
 * copy of a map that isn't in any slot yet, e.g. one that came with a shared link ("save").
 */
export default function CustomMapModal(props: { mode: "import" | "save"; onClose: () => void }) {
	const mount = document.querySelector<HTMLElement>("#body") ?? document.body;
	const [text, setText] = createSignal("");
	const [error, setError] = createSignal("");
	const [chosen, setChosen] = createSignal<number | null>(slots().findIndex((map) => map === null));
	const [confirmOverwrite, setConfirmOverwrite] = createSignal(false);
	const slot = () => chosen() ?? -1;

	/** The map to store, named so it doesn't clash with a built-in or another slot; null (with the error shown) when there isn't one. */
	const incoming = (): MapGrid | null => {
		let map: MapGrid;
		if (props.mode === "import") {
			try {
				map = parseMapJson(text());
			} catch (e) {
				setError(e instanceof Error ? e.message : String(e));
				return null;
			}
		} else if (state.customMap) {
			// keeps its id, so later edits to the slot reach this timeline
			map = toPlainMap(state.customMap);
		} else {
			setError("This timeline doesn't use a custom map");
			return null;
		}
		map.name = uniqueMapName(map.name, slots(), slot());
		return map;
	};

	const store = () => {
		const map = incoming();
		if (!map || slot() < 0) return;
		selectMap(map);
		saveSlot(slot(), map);
		saveToLocalStorage();
		props.onClose();
	};

	const confirm = () => {
		setError("");
		if (slot() < 0) {
			setError("Choose a slot");
			return;
		}
		if (!incoming()) return;
		if (slots()[slot()]) setConfirmOverwrite(true);
		else store();
	};

	return (
		<Portal mount={mount}>
			<FullScreen>
				<Modal width="w-150">
					<ModalHeader title={props.mode === "import" ? "Import Custom Map" : "Save Map to Slot"} />
					<div class="flex flex-col gap-2 px-3 text-sm font-bold text-[#1C2A32]">
						<Show when={props.mode === "import"}>
							<textarea
								value={text()}
								onInput={(e) => setText(e.currentTarget.value)}
								spellcheck={false}
								class="h-36 shrink-0 resize-none rounded-md bg-zinc-950 p-3 font-mono text-xs font-normal text-[#EFEFEF]"
								placeholder="Paste map JSON exported from the Map Editor..."
							/>
						</Show>
						<Show when={props.mode === "save"}>
							<div class="text-[#384B53]">
								Keep "{state.customMap?.name}" in a slot so you can edit it and use it in other timelines.
							</div>
						</Show>
						<div class="text-md flex h-9 items-center bg-[#384B53] px-3 tracking-wide text-[#ECECEC]">Choose a slot</div>
						<For each={Array.from({ length: MAP_SLOT_COUNT }, (_, i) => i)}>
							{(index) => (
								<button
									type="button"
									onClick={() => setChosen(index)}
									class={`gf-card flex cursor-pointer items-center gap-3 text-left outline-3 ${chosen() === index ? "outline-[#F0AF16]" : "outline-transparent hover:outline-white"}`}>
									<span>Slot {index + 1}</span>
									<span class={`truncate ${slots()[index] ? "" : "font-normal text-[#9AA3A8] italic"}`}>
										{slots()[index]?.name ?? "Empty"}
									</span>
								</button>
							)}
						</For>
						<Show when={error()}>
							<div class="text-[#AE4749]">{error()}</div>
						</Show>
					</div>
					<ModalFooter styles="justify-between">
						<Button
							onClick={() => {
								props.onClose();
							}}
							color="dark"
							design="cancel"
						/>
						<Button onClick={confirm} color="dark" design="confirm" />
					</ModalFooter>
				</Modal>
			</FullScreen>
			<ConfirmModal
				mount={mount}
				title="Replace map"
				content={`Replace "${slots()[slot()]?.name ?? ""}" in slot ${slot() + 1}?`}
				isActive={confirmOverwrite}
				setActive={setConfirmOverwrite}
				onClick={store}
			/>
		</Portal>
	);
}
