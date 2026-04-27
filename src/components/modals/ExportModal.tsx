import { createMemo, createResource, createSignal } from "solid-js";
import { compress, state, setShowExportModal, getDollNamesAndFortifications } from "../../store";
import { Select } from "@thisbeyond/solid-select";
import { SAVE_VERSION } from "../../types/constants";
import Button from "../buttons/Button";
import ModalFooter from "./ModalFooter";
import ModalHeader from "./ModalHeader";

export default function ExportModal() {
	const exportOptions = ["code only", "code for discord", "shareable url"];
	const [exportType, setExportType] = createSignal(exportOptions[2]);
	const [copied, setCopied] = createSignal(false);

	const getExportString = async () => {
		const exportObj = { version: SAVE_VERSION, ...state };
		return await compress(JSON.stringify(exportObj));
	};

	const [exportString] = createResource(getExportString);

	const output = createMemo(() => {
		const dolls = getDollNamesAndFortifications();
		if (exportType() === exportOptions[0]) return exportString();
		if (exportType() === exportOptions[1]) return dolls.join(", ") + "\n" + "```" + exportString() + "```";
		if (exportType() === exportOptions[2])
			return dolls.join(", ") + "\n" + `${window.location.origin + window.location.pathname}?state=` + exportString();
		return exportString();
	});

	const handleCopy = async () => {
		await navigator.clipboard.writeText(output() ?? "");
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	};

	return (
		<>
			<ModalHeader title="Export Transcript" />
			<div class="flex flex-col gap-3">
				<div class="text-md mx-3 flex h-10 items-center justify-center self-stretch bg-[#384B53] font-bold tracking-wide text-[#ECECEC]">
					Export as Text
				</div>
				<div class="mx-3 flex flex-row items-center justify-center gap-1 text-[#384B53]">
					<span>Export style:</span>
					<Select class="custom" options={exportOptions} onChange={setExportType} initialValue={exportType()} />
				</div>
				<textarea
					value={output()}
					class="mx-3 h-48 resize-none items-center justify-center self-stretch rounded-md bg-zinc-950 p-2 font-mono text-xs"
					placeholder="Loading..."
				/>
			</div>
			<ModalFooter styles="justify-between">
				<Button onClick={() => setShowExportModal(false)} color="dark" design="cancel" content="Close" />
				<Button onClick={handleCopy} color="dark" design="confirm" content={copied() ? "Copied!" : "Copy Text"} />
			</ModalFooter>
		</>
	);
}
