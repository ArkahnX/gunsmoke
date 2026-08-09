import { createMemo, createResource, createSignal, Show } from "solid-js";
import {
	compress,
	state,
	setShowExportModal,
	getDollNamesAndFortifications,
	setState,
	displaySmallKeys,
	sortDisplayEquippedKeys,
	getDollFromId,
	saveToLocalStorage,
} from "../../store";
import { Select } from "@thisbeyond/solid-select";
import { SAVE_VERSION } from "../../types/constants";
import { ApiResponse } from "../../types";
import Button from "../buttons/Button";
import ModalFooter from "./ModalFooter";
import ModalHeader from "./ModalHeader";
import { produce } from "solid-js/store";

export default function ExportModal() {
	const exportOptions = ["code only", "code for discord", "shareable url"];
	const [activeTab, setActiveTab] = createSignal("export");
	const [errorText, setErrorText] = createSignal("");
	const [readiness, setReadiness] = createSignal("");
	const [shareLink, setShareLink] = createSignal("");
	const isExportTab = () => activeTab() === "export";
	const isShareTab = () => activeTab() === "share";
	const [exportType, setExportType] = createSignal(exportOptions[2]);
	const [copied, setCopied] = createSignal(false);

	const getExportString = async () => {
		const exportObj = { version: SAVE_VERSION, ...state };
		return await compress(exportObj);
	};

	const [exportString] = createResource(getExportString);

	const output = createMemo(() => {
		const dolls = getDollNamesAndFortifications();
		if (exportType() === exportOptions[0]) return exportString();
		if (exportType() === exportOptions[1]) return dolls.join(", ") + "\n" + "```" + exportString() + "```";
		if (exportType() === exportOptions[2])
			return `[Timeline: ${dolls.join(", ")}](${window.location.origin + window.location.pathname}?state=${exportString()})`;
		return exportString();
	});

	const handleCopy = async () => {
		await navigator.clipboard.writeText(output() ?? "");
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	};

	const beforeShare = () => {
		let value = [];
		let missingKeys = [];
		if (state.score === 0) {
			value.push("Include a predicted final score for this investment.");
		}
		for (const doll of state.selectedDolls) {
			const keys = sortDisplayEquippedKeys(doll.id, doll.keys);
			const fixedKeys = keys.filter((key) => key !== null && key.type === "Fixed Key");
			if (fixedKeys.length < 3) {
				const dollInfo = getDollFromId(doll.id);
				if (!dollInfo) continue;
				missingKeys.push(`${dollInfo.name} is missing fixed keys`);
			}
		}
		if (missingKeys.length > 2) {
			value.push("Multiple dolls are missing fixed keys.");
		} else {
			value.push(...missingKeys);
		}
		setReadiness(value.join("\n"));
	};

	const shareTranscript = async () => {
		setErrorText("");
		setShareLink("");
		if (readiness() !== "") return false;
		const exportObj = { version: SAVE_VERSION, ...state };
		try {
			const encoded = await compress(exportObj);
			const res = await fetch("https://gunsmoke.arkahnx.technology/state", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					map: exportObj.map,
					dolls: exportObj.selectedDolls.map((d) => ({ id: d.id, fortification: d.fortification })),
					score: exportObj.score,
					description: exportObj.description,
					state: encoded,
				}),
			});

			const data = (await res.json()) as ApiResponse<{ stateId: string }>;
			if (data.error) {
				setErrorText(data.error);
				return;
			}
			if (data.result) {
				setShareLink(`${window.location.origin + window.location.pathname}?stateId=${data.result.stateId}`);
				saveToLocalStorage();
			}
		} catch (e: unknown) {
			setErrorText((e as Error).message);
			return;
		}
	};

	const updateScore = (e: InputEvent) => {
		setState(
			produce((s) => {
				if (e.currentTarget instanceof HTMLInputElement) {
					s.score = parseInt(e.currentTarget?.value);
				}
			})
		);
		beforeShare();
	};

	const updateDescription = (e: InputEvent) => {
		setState(
			produce((s) => {
				if (e.currentTarget instanceof HTMLTextAreaElement) {
					s.description = e.currentTarget.value;
				}
			})
		);
	};

	beforeShare();

	return (
		<>
			<ModalHeader title="Export Transcript" />
			<div class="flex gap-1 px-3 pb-1.75">
				<button
					onClick={() => {
						setActiveTab("export");
					}}
					class={`flex h-13 flex-1 items-center justify-center gap-1 rounded-t-sm border-b-4 px-1 pt-3 pb-2 text-2xl font-bold transition-all ${
						isExportTab()
							? "border-[#F0AF16] bg-[#384B53] text-[#EFEFEF] shadow-xl/20"
							: "border-[#8F9094] bg-[#A8A9AE] text-[#384B53] hover:border-[#606164]"
					}`}>
					<span>Export</span>
				</button>
				<button
					onClick={() => {
						setActiveTab("share");
					}}
					class={`flex h-13 flex-1 items-center justify-center gap-1 rounded-t-sm border-b-4 px-1 pt-3 pb-2 text-2xl font-bold transition-all ${
						isShareTab()
							? "border-[#F0AF16] bg-[#384B53] text-[#EFEFEF] shadow-xl/20"
							: "border-[#8F9094] bg-[#A8A9AE] text-[#384B53] hover:border-[#606164]"
					}`}>
					<span>Share</span>
				</button>
			</div>
			<Show when={isExportTab()}>
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
			</Show>
			<Show when={isShareTab()}>
				<div class="flex flex-col gap-3">
					<Show when={readiness() !== ""}>
						<div class="text-md mx-3 flex items-center justify-center self-stretch bg-[#384B53] p-2 text-center font-bold tracking-wide text-[#ECECEC]">
							{readiness()}
						</div>
					</Show>
					<label class="mx-3 flex flex-row items-center justify-center gap-1 text-[#384B53]">
						Score: <input class="input" type="number" value={state.score} onInput={updateScore} />
					</label>
					<textarea
						value={state.description}
						maxLength={128}
						onInput={updateDescription}
						class="input mx-3 h-16 resize-none items-center justify-center self-stretch overflow-hidden rounded-md p-2 text-xs"
						placeholder="Optional Description..."
					/>
					<Show when={errorText() !== ""}>
						<div class="text-md mx-3 flex items-center justify-center self-stretch bg-[#AE4749] p-2 text-center font-bold tracking-wide text-[#ECECEC]">
							{errorText()}
						</div>
					</Show>
					<Show when={shareLink() !== ""}>
						<div class="text-md mx-3 flex h-10 items-center justify-center self-stretch bg-[#384B53] font-bold tracking-wide text-[#ECECEC]">
							Share Link
						</div>
						<textarea
							value={shareLink()}
							class="mx-3 h-16 resize-none items-center justify-center self-stretch rounded-md bg-zinc-950 p-2 font-mono text-xs"
							placeholder="Loading..."
						/>
					</Show>
				</div>
				<ModalFooter styles="justify-between">
					<Button onClick={() => setShowExportModal(false)} color="dark" design="cancel" content="Close" />
					<Button
						onClick={shareTranscript}
						disabled={readiness() !== ""}
						color="dark"
						design="confirm"
						content="Share Transcript"
					/>
				</ModalFooter>
			</Show>
		</>
	);
}
