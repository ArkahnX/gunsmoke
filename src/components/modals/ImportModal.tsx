import { createSignal } from "solid-js";
import { setShowImportModal, loadState, preloadCanvasImages, saveToLocalStorage, defaultActionOrder, decompress } from "../../store";
import { SAVE_VERSION } from "../../types/constants";
import Button from "../buttons/Button";
import ModalFooter from "./ModalFooter";
import ModalHeader from "./ModalHeader";

export default function ImportModal() {
	const [text, setText] = createSignal("");

	const performImport = async () => {
		try {
			const decompressed = await decompress(text().trim());
			const parsed = JSON.parse(decompressed);
			if (parsed.version !== SAVE_VERSION) {
				alert("Unsupported version");
				return;
			}
			loadState(parsed);
			for (let i = 0; i < 8; i++) defaultActionOrder(i);
			await preloadCanvasImages();
			setShowImportModal(false);
			saveToLocalStorage();
			alert("✅ Import successful!");
		} catch (e) {
			console.error(e);
			alert("Invalid string!");
		}
	};

	return (
		<>
			<ModalHeader title="Import Transcript" />
			<div class="flex flex-col gap-3">
				<textarea
					value={text()}
					onInput={(e) => setText(e.currentTarget.value)}
					class="mx-3 h-48 resize-none items-center justify-center self-stretch rounded-md bg-zinc-950 p-4 font-mono text-xs"
					placeholder="Paste here..."
				/>
				<div class="text-md mx-3 flex h-10 items-center justify-center self-stretch bg-[#384B53] font-bold tracking-wide text-[#ECECEC]">
					Imported state will overwrite all current settings
				</div>
			</div>
			<ModalFooter styles="justify-between">
				<Button onClick={() => setShowImportModal(false)} color="dark" design="cancel" />
				<Button onClick={performImport} color="dark" design="confirm" />
			</ModalFooter>
		</>
	);
}
