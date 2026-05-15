import { createSignal } from "solid-js";
import { setShowImportModal, setLoaded, importState, loadFromString } from "../../store";
import Button from "../buttons/Button";
import ModalFooter from "./ModalFooter";
import ModalHeader from "./ModalHeader";

export default function ImportModal() {
	const [text, setText] = createSignal("");

	const performImport = async () => {
		setLoaded(false);
		await importState(loadFromString, text(), true);
		setShowImportModal(false);
		setLoaded(true);
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
