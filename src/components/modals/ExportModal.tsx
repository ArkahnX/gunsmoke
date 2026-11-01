import { createEffect, createMemo, createSignal, For, on, Show } from "solid-js";
import { produce } from "solid-js/store";
import { trackStore } from "@solid-primitives/deep";
import { ApiResponse } from "../../types";
import Button from "../buttons/Button";
import ModalFooter from "./ModalFooter";
import ModalHeader from "./ModalHeader";
import { localState, setLocalState, setState, state } from "../../store/appState";
import { compress } from "../../store/persistence";
import { sortDisplayEquippedKeys } from "../../store/keys";
import { setShowExportModal, setShowIssuesModal } from "../../store/uiState";
import { getCurrentSeason, getSelectedDollNamesAndFortifications, getSelectedDoll } from "../../store/gameData";
import { isBuiltInMap } from "../../canvas/editorMap";
import { KeyType } from "../../../gfl2-data/enums";
import { saveToLocalStorage } from "../../store/storage";
import { isShareable, saveIssueGroups } from "../../store/validation";
import { plural } from "./IssuesModal";

const MAX_DESCRIPTION_LENGTH = 128;

type Mode = "export" | "share";

interface OutputOptions {
	/** What goes before the code or link (season, boss, dolls); empty for none */
	header: string;
	discord: boolean;
}

/** The checkboxes in the options rows, each a remembered setting. */
type OptionKey = "exportIncludeSeason" | "exportIncludeBoss" | "exportIncludeDolls" | "exportAsLink" | "exportDiscord";

const HELP = {
	score: "Providing an accurate score allows for timelines to be sorted by score with those selected dolls at that investment.",
	description: "Description is optional to include extra notes about the timeline if needed.",
	fixedKeys: "3 Fixed Keys are required for shared timelines so consumers have a minimum build to copy.",
};

/** The text copied from Export: the code, optionally after the header and/or in a Discord code block. */
function formatExportText(code: string, options: OutputOptions): string {
	const body = options.discord ? "```" + code + "```" : code;
	return options.header ? `${options.header}\n${body}` : body;
}

/** The text copied as a link: the bare link, optionally after the header and/or as a Discord markdown link. */
function formatLinkText(url: string, options: OutputOptions): string {
	if (options.discord) return `[${options.header ? `Timeline: ${options.header}` : "Gunsmoke timeline"}](${url})`;
	return options.header ? `${options.header}\n${url}` : url;
}

/** Discord's message limit, and the most a link may be; the copied text never goes over it. */
const TEXT_LIMIT = 2000;

type IncludeKey = "season" | "boss" | "dolls";
/** How much each part is worth keeping when the text has to shrink: boss, then the team, then the season. */
const INCLUDE_WEIGHT: Record<IncludeKey, number> = { boss: 4, dolls: 2, season: 1 };

interface HeaderPart {
	key: IncludeKey;
	text: string;
}

/** The switched-on parts of `Season 10 | Temblor Titan | Mityl (V0), …`, in that order. */
function headerParts(): HeaderPart[] {
	const parts: HeaderPart[] = [];
	// timelines don't record their season, so this is the season that's live now; test seasons have no number
	const seasonNumber = getCurrentSeason().season;
	if (localState.exportIncludeSeason && seasonNumber !== undefined && seasonNumber > 0) {
		parts.push({ key: "season", text: `Season ${seasonNumber}` });
	}
	// maps are named after their boss; a custom map has none
	if (localState.exportIncludeBoss && isBuiltInMap(state.map)) parts.push({ key: "boss", text: state.map });
	if (localState.exportIncludeDolls) parts.push({ key: "dolls", text: getSelectedDollNamesAndFortifications().join(", ") });
	return parts;
}

interface FittedText {
	text: string;
	/** Includes left out to stay within `TEXT_LIMIT` */
	dropped: IncludeKey[];
	/** Discord formatting left out as a last resort, when even the bare link only fits without it */
	plain: boolean;
	/** Over `TEXT_LIMIT` even with nothing included and no formatting */
	tooLong: boolean;
}

/**
 * The fullest text within `TEXT_LIMIT`: every combination of the switched-on parts is tried, keeping as many as
 * possible and, among equally many, the most important ones. `build` makes the text for a header and format.
 */
function fitText(parts: HeaderPart[], discord: boolean, build: (options: OutputOptions) => string): FittedText {
	const subsets = Array.from({ length: 1 << parts.length }, (_, mask) => parts.filter((_part, i) => mask & (1 << i)));
	const weight = (subset: HeaderPart[]) => subset.reduce((sum, part) => sum + INCLUDE_WEIGHT[part.key], 0);
	subsets.sort((a, b) => b.length - a.length || weight(b) - weight(a));
	const droppedFrom = (kept: HeaderPart[]) => parts.filter((part) => !kept.includes(part)).map((part) => part.key);
	for (const kept of subsets) {
		const text = build({ header: kept.map((part) => part.text).join(" | "), discord });
		if (text.length <= TEXT_LIMIT) return { text, dropped: droppedFrom(kept), plain: false, tooLong: false };
	}
	const bare = build({ header: "", discord: false });
	return { text: bare, dropped: droppedFrom([]), plain: discord, tooLong: bare.length > TEXT_LIMIT };
}

/** A "?" that explains the item next to it on hover or keyboard focus. */
function HelpTip(props: { text: string }) {
	return (
		<span
			tabIndex={0}
			title={props.text}
			aria-label={props.text}
			class="inline-flex h-4 w-4 shrink-0 cursor-help items-center justify-center rounded-full bg-[#384B53] text-[10px] font-bold text-[#EFEFEF]">
			?
		</span>
	);
}

function ModeCard(props: { selected: boolean; title: string; description: string; onClick: () => void }) {
	return (
		<button
			role="tab"
			aria-selected={props.selected}
			onClick={props.onClick}
			class={`relative flex flex-1 flex-col items-start gap-1 rounded-sm border-2 border-b-4 px-3 pt-2.5 pb-2 text-left transition-all ${
				props.selected
					? "border-[#384B53] border-b-[#F0AF16] bg-[#384B53] text-[#EFEFEF] shadow-xl/20"
					: "cursor-pointer border-[#8F9094] bg-[#E4E3E7] text-[#384B53] outline-3 outline-transparent hover:border-[#606164] hover:outline-white"
			}`}>
			<span class="text-2xl font-bold">{props.title}</span>
			<span class="text-sm leading-tight">{props.description}</span>
		</button>
	);
}

/** An unmet requirement for sharing; met ones aren't listed. */
function CheckItem(props: { label: string; detail?: string; help?: string }) {
	return (
		<li class="flex items-center gap-2">
			<span class="w-4 shrink-0 text-center font-bold text-[#AE4749]">✗</span>
			<span>
				{props.label}
				<Show when={props.detail}>
					<span class="text-xs text-[#606164]"> ({props.detail})</span>
				</Show>
			</span>
			<Show when={props.help}>{(help) => <HelpTip text={help()} />}</Show>
		</li>
	);
}

export default function ExportModal() {
	const [mode, setMode] = createSignal<Mode>("export");
	const [errorText, setErrorText] = createSignal("");
	const [shareLink, setShareLink] = createSignal("");
	const [uploading, setUploading] = createSignal(false);
	const [copied, setCopied] = createSignal("");

	const groups = saveIssueGroups;

	// The export code follows the timeline, so fixes made on the Share tab show up here too
	const [exportCode, setExportCode] = createSignal("");
	let codeRequest = 0;
	createEffect(() => {
		trackStore(state);
		const request = ++codeRequest;
		void compress().then((code) => {
			if (request === codeRequest) setExportCode(code);
		});
	});

	// A link for an older version of the timeline shouldn't be copied
	createEffect(
		on(
			() => trackStore(state),
			() => setShareLink(""),
			{ defer: true }
		)
	);

	const copy = async (text: string, what: string) => {
		await navigator.clipboard.writeText(text);
		setCopied(what);
		setTimeout(() => setCopied(""), 2000);
	};

	const score = () => (Number.isFinite(state.score) ? state.score : 0);
	const missingFixedKeys = createMemo(() =>
		state.selectedDolls
			.filter((doll) => sortDisplayEquippedKeys(doll).filter((key) => key !== null && key.type === KeyType.FixedKey).length < 3)
			.map((doll) => getSelectedDoll(doll).name)
	);
	const checks = createMemo(() => [
		{ ok: score() > 0, label: "Final score", detail: "enter the score from the end of the run", help: HELP.score },
		{
			ok: missingFixedKeys().length === 0,
			label: "Every doll has 3 Fixed Keys",
			detail: `missing: ${missingFixedKeys().join(", ")}`,
			help: HELP.fixedKeys,
		},
		// the text box stops at the limit, but an imported timeline can be over it
		{
			ok: state.description.length <= MAX_DESCRIPTION_LENGTH,
			label: "Description",
			detail: `max ${MAX_DESCRIPTION_LENGTH} characters`,
			help: HELP.description,
		},
	]);
	const unmetChecks = () => checks().filter((check) => !check.ok);
	const canShare = () => isShareable() && unmetChecks().length === 0 && !uploading();

	const pageUrl = () => window.location.origin + window.location.pathname;
	const exportFit = createMemo((): FittedText | null => {
		const code = exportCode();
		if (!code) return null;
		// a `?state=` link opens the timeline directly, the same way a shared `?stateId=` link does
		const url = `${pageUrl()}?state=${code}`;
		return fitText(headerParts(), localState.exportDiscord, (options) =>
			localState.exportAsLink ? formatLinkText(url, options) : formatExportText(code, options)
		);
	});
	/** What the textbox shows and Copy copies; empty when even the bare code or link is over `TEXT_LIMIT`. */
	const fittingText = (fit: FittedText | null) => (fit && !fit.tooLong ? fit.text : "");
	const exportText = () => fittingText(exportFit());
	const shareUrl = (stateId: string) => `${pageUrl()}?stateId=${stateId}`;
	const shareFit = createMemo((): FittedText | null => {
		const link = shareLink();
		if (!link) return null;
		return fitText(headerParts(), localState.exportDiscord, (options) => formatLinkText(link, options));
	});
	const shareText = () => fittingText(shareFit());

	const shareTranscript = async () => {
		setErrorText("");
		setShareLink("");
		if (!canShare()) return;
		setUploading(true);
		try {
			const encoded = await compress();
			const res = await fetch("https://gunsmoke.arkahnx.technology/state", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					map: state.map,
					dolls: state.selectedDolls.map((d) => ({ id: d.id, fortification: d.fortification })),
					score: state.score,
					description: state.description,
					state: encoded,
				}),
			});

			const data = (await res.json()) as ApiResponse<{ stateId: string }>;
			if (data.error) {
				setErrorText(data.error);
				return;
			}
			if (data.result) {
				saveToLocalStorage();
				setShareLink(shareUrl(data.result.stateId));
			}
		} catch (e: unknown) {
			setErrorText((e as Error).message);
		} finally {
			setUploading(false);
		}
	};

	const updateScore = (e: InputEvent) => {
		setState(
			produce((s) => {
				if (e.currentTarget instanceof HTMLInputElement) {
					s.score = parseInt(e.currentTarget.value);
				}
			})
		);
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

	/** Problem count with a button to the issues modal; optional on Export, required before uploading on Share. */
	const issuesRow = (heading: string) => (
		<Show when={groups().length}>
			<section class="flex items-center justify-between gap-3 rounded-sm bg-[#E4E3E7] p-2">
				<h3 class="text-sm font-bold">{heading}</h3>
				<Button onClick={() => setShowIssuesModal(true)} color="red" design="custom" content="Fix Issues" badge={groups().length} />
			</section>
		</Show>
	);

	/** Share is always a link; Export is the code unless "As a link" is on. */
	const isLink = (tab: Mode) => tab === "share" || localState.exportAsLink;

	/** Character count, and what to do when even the bare code or link is over the limit (the textbox stays empty). */
	const fitStatus = (fit: FittedText | null, isLinkText: boolean) => (
		<Show when={fit}>
			{(f) => (
				<div class="flex flex-col gap-1 text-xs">
					<span class={`self-end ${f().tooLong ? "font-bold text-[#AE4749]" : "text-[#606164]"}`}>
						{f().text.length}/{TEXT_LIMIT} characters
					</span>
					<Show when={f().tooLong}>
						<span class="rounded-sm bg-[#AE4749] p-1.5 font-bold text-[#EFEFEF]">
							{isLinkText
								? `This timeline makes a ${f().text.length.toLocaleString()}-character link, over the ${TEXT_LIMIT.toLocaleString()}-character limit, so it can't be copied as a link. If this is a completed timeline use share for a short link instead.`
								: `This timeline's code is ${f().text.length.toLocaleString()} characters, over the ${TEXT_LIMIT.toLocaleString()}-character limit, so it can't be copied. If this is a completed timeline use share for a short link instead.`}
						</span>
					</Show>
				</div>
			)}
		</Show>
	);

	/** `forcedOff`: switched on, but turned off for now because the text would go over `TEXT_LIMIT` with it. */
	const option = (key: OptionKey, label: string, forcedOff = false) => (
		<label
			class={`flex items-center gap-1.5 ${forcedOff ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}
			title={forcedOff ? `Turned off: this would make the text longer than ${TEXT_LIMIT.toLocaleString()} characters` : undefined}>
			<input
				type="checkbox"
				// the setting itself is kept, so it comes back on its own once the timeline is short enough again
				checked={localState[key] && !forcedOff}
				disabled={forcedOff}
				onChange={(e) => {
					const checked = e.currentTarget.checked;
					setLocalState(
						produce((s) => {
							s[key] = checked;
						})
					);
				}}
			/>
			{label}
		</label>
	);

	const optionsRow = (tab: Mode) => {
		const fit = () => (tab === "export" ? exportFit() : shareFit());
		const droppedInclude = (key: IncludeKey) => fit()?.dropped.includes(key) ?? false;
		return (
			<section class="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-1.5 text-sm">
				<span class="font-bold">Include:</span>
				<div class="flex flex-row flex-wrap gap-4">
					{option("exportIncludeSeason", "Season", droppedInclude("season"))}
					{option("exportIncludeBoss", "Boss", droppedInclude("boss"))}
					{option("exportIncludeDolls", "Dolls", droppedInclude("dolls"))}
				</div>
				<span class="font-bold">Format:</span>
				<div class="flex flex-row flex-wrap gap-4">
					<Show when={tab === "export"}>{option("exportAsLink", "As a link")}</Show>
					{option("exportDiscord", isLink(tab) ? "Discord link" : "Discord code block", fit()?.plain ?? false)}
				</div>
			</section>
		);
	};

	return (
		<>
			<ModalHeader title="Export / Share" />
			<div role="tablist" class="flex gap-2 px-3 pb-2">
				<ModeCard
					selected={mode() === "export"}
					title="Export"
					description="For any timelines: export the timeline code"
					onClick={() => setMode("export")}
				/>
				<ModeCard
					selected={mode() === "share"}
					title="Share"
					description="For finished timelines: Upload and share a short link"
					onClick={() => setMode("share")}
				/>
			</div>
			<Show when={mode() === "export"}>
				<div class="mx-3 flex flex-col gap-3 text-[#384B53]">
					{issuesRow("Consider fixing issues before exporting")}
					{optionsRow("export")}
					<textarea
						value={exportText()}
						readOnly
						class="h-40 resize-none self-stretch rounded-md bg-zinc-950 p-2 font-mono text-xs break-all text-[#EFEFEF]"
						placeholder={exportFit()?.tooLong ? "Too long to export, see below" : "Loading..."}
					/>
					{fitStatus(exportFit(), localState.exportAsLink)}
				</div>
				<ModalFooter styles="justify-between">
					<Button onClick={() => setShowExportModal(false)} color="dark" design="cancel" content="Close" />
					<Button
						onClick={() => void copy(exportText(), "code")}
						disabled={exportText() === ""}
						color="dark"
						design="confirm"
						content={copied() === "code" ? "Copied!" : localState.exportAsLink ? "Copy Link" : "Copy Code"}
					/>
				</ModalFooter>
			</Show>
			<Show when={mode() === "share"}>
				<div class="mx-3 flex flex-col gap-3 text-[#384B53]">
					{issuesRow(`Required to fix ${plural(groups().length, "issue")} before sharing`)}
					<section class="flex flex-col gap-1.5">
						{/* only what's still missing; nothing is listed once every check is met */}
						<Show when={unmetChecks().length}>
							<h3 class="font-bold">Before sharing</h3>
							<ul class="flex flex-col gap-1 text-sm">
								<For each={unmetChecks()}>
									{(check) => <CheckItem label={check.label} detail={check.detail} help={check.help} />}
								</For>
							</ul>
						</Show>
						<label class="flex flex-row items-center gap-2 text-sm">
							<HelpTip text={HELP.score} />
							Score:
							<input class="input" type="number" min="1" value={score() || ""} onInput={updateScore} placeholder="Required" />
						</label>
						<div class="flex items-center gap-2 text-sm">
							<HelpTip text={HELP.description} />
							Description:
						</div>
						<textarea
							value={state.description}
							maxLength={MAX_DESCRIPTION_LENGTH}
							onInput={updateDescription}
							class="input h-16 resize-none self-stretch overflow-hidden rounded-md p-2 text-xs"
							placeholder="Optional notes about the timeline..."
						/>
						<span class="self-end text-xs text-[#606164]">
							{state.description.length}/{MAX_DESCRIPTION_LENGTH}
						</span>
					</section>
					{optionsRow("share")}
					<Show when={errorText() !== ""}>
						<div class="flex items-center justify-center self-stretch bg-[#AE4749] p-2 text-center font-bold tracking-wide text-[#ECECEC]">
							{errorText()}
						</div>
					</Show>
					<Show when={shareLink() !== ""}>
						<textarea
							value={shareText()}
							readOnly
							class="h-16 resize-none self-stretch rounded-md bg-zinc-950 p-2 font-mono text-xs break-all text-[#EFEFEF]"
						/>
						{fitStatus(shareFit(), true)}
					</Show>
				</div>
				<ModalFooter styles="justify-between">
					<Button onClick={() => setShowExportModal(false)} color="dark" design="cancel" content="Close" />
					<Show
						when={shareLink() !== ""}
						fallback={
							<Button
								onClick={() => void shareTranscript()}
								disabled={!canShare()}
								color="dark"
								design="confirm"
								content={uploading() ? "Uploading..." : "Upload & get link"}
							/>
						}>
						<Button
							onClick={() => void copy(shareText(), "link")}
							disabled={shareText() === ""}
							color="dark"
							design="confirm"
							content={copied() === "link" ? "Copied!" : "Copy Link"}
						/>
					</Show>
				</ModalFooter>
			</Show>
		</>
	);
}
