import { createSignal, For } from "solid-js";
import Button from "../buttons/Button";
import ModalFooter from "./ModalFooter";
import ModalHeader from "./ModalHeader";
import { importErrors, setImportErrors } from "../../store/uiState";

export default function ErrorModal() {
	const [copied, setCopied] = createSignal(false);

	const details = () =>
		importErrors()
			.map((report) => report.details)
			.join("\n\n----------\n\n");

	const handleCopy = async () => {
		await navigator.clipboard.writeText(details());
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	};

	return (
		<>
			<ModalHeader title="Something went wrong" />
			<div class="flex flex-col gap-3">
				<div class="text-md mx-3 flex flex-col items-center justify-center gap-1 self-stretch bg-[#AE4749] p-2 text-center font-bold tracking-wide text-[#ECECEC]">
					<For each={importErrors()}>{(report) => <span>{report.message}</span>}</For>
				</div>
				<div class="mx-3 text-center text-[#384B53]">
					Please copy the details below and send them to ArkahnX so this can be fixed.
				</div>
				<textarea
					value={details()}
					readOnly
					onFocus={(e) => {
						e.currentTarget.select();
					}}
					class="mx-3 h-48 resize-none items-center justify-center self-stretch rounded-md bg-zinc-950 p-2 font-mono text-xs"
				/>
			</div>
			<ModalFooter styles="justify-between">
				<Button onClick={() => setImportErrors([])} color="dark" design="cancel" content="Close" />
				<Button onClick={() => void handleCopy()} color="dark" design="confirm" content={copied() ? "Copied!" : "Copy Details"} />
			</ModalFooter>
		</>
	);
}
