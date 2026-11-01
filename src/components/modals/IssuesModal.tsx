import { createSignal, For, Show } from "solid-js";
import Button from "../buttons/Button";
import Bolt from "../icons/Bolt";
import ModalFooter from "./ModalFooter";
import ModalHeader from "./ModalHeader";
import { setShowIssuesModal } from "../../store/uiState";
import { ErrorGroup, fixKey, issueSubject, saveIssueGroups, saveIssueSections } from "../../store/validation";
import {
	applyToGroup,
	canApplyFix,
	cantApplyReason,
	describeFix,
	describeRemoval,
	fixAll,
	fullSlotsEquip,
	openTargetPicker,
	groupAutoFixes,
	groupRemovalLocations,
	MANUAL_FIX_REASON,
} from "../../store/saveFixes";
import { openDollKeys } from "../../store/dollSelection";
import { getDollById } from "../../store/gameData";
import { FixKey, SaveFix } from "../../types/issues";

export function plural(count: number, word: string, many = word + "s") {
	return `${count} ${count === 1 ? word : many}`;
}

/** Green: what "Fix automatically" applies for the issue. */
const AUTO_COLOR = "bg-[#3D7A4A]";

function FixButton(props: { fix: SaveFix; group: ErrorGroup; auto: boolean; disabled: boolean; onClick: () => void }) {
	const applicable = () => canApplyFix(props.fix);
	const removes = () => props.fix.kind === FixKey.RemoveEntry;
	// a removal applies to every entry in the group, so name them all rather than just the first
	const label = () => (removes() ? describeRemoval(groupRemovalLocations(props.group)) : describeFix(props.fix));
	// why it's greyed out, joined onto the button's right; the generic reason is left to "Cannot be automatically fixed"
	const blockedReason = () => {
		if (applicable()) return undefined;
		const reason = cantApplyReason(props.fix);
		return reason === MANUAL_FIX_REASON ? undefined : reason;
	};
	const title = () =>
		!applicable()
			? blockedReason()
				? undefined
				: cantApplyReason(props.fix)
			: props.auto
				? "Applied by Fix automatically"
				: undefined;
	return (
		// one chip with its reason, so it wraps along with the other buttons rather than leaving a gap beside or under it
		<div class="flex max-w-full items-stretch rounded-sm shadow-sm shadow-black/30">
			<button
				onClick={props.onClick}
				disabled={props.disabled || !applicable()}
				title={title()}
				class={`flex items-center gap-1 px-2 py-0.5 text-left text-xs font-bold text-[#EFEFEF] ${blockedReason() ? "rounded-l-sm" : "rounded-sm"} ${
					props.auto ? AUTO_COLOR : removes() ? "bg-[#944040]" : "bg-[#1C2A32]"
				} ${props.disabled || !applicable() ? "cursor-default opacity-50" : "cursor-pointer outline-2 outline-transparent hover:outline-white"}`}>
				<Show when={props.auto}>
					<span class="h-3 w-3 shrink-0">
						<Bolt />
					</span>
				</Show>
				{label()}
			</button>
			<Show when={blockedReason()}>
				<span class="flex min-w-0 items-center rounded-r-sm bg-[#C9C8CE] px-1.5 py-0.5 text-xs text-[#384B53]">
					{blockedReason()}
				</span>
			</Show>
		</div>
	);
}

/** Every problem in the timeline with its one-click fixes. Optional for an exported copy, required before sharing. */
export default function IssuesModal() {
	const [fixing, setFixing] = createSignal(false);
	const [fixResult, setFixResult] = createSignal("");

	const groups = saveIssueGroups;
	const autoFixable = () => groups().filter((group) => groupAutoFixes(group).length > 0).length;

	const runFixAll = async () => {
		const before = groups().length;
		setFixing(true);
		try {
			const applied = await fixAll();
			const fixed = before - groups().length;
			setFixResult(
				fixed > 0
					? `Fixed ${plural(fixed, "problem")}`
					: applied
						? `Applied ${plural(applied, "fix", "fixes")}`
						: "Nothing could be fixed automatically"
			);
		} finally {
			setFixing(false);
		}
	};

	const runGroupFix = async (group: ErrorGroup, fix: SaveFix) => {
		setFixResult("");
		if (fix.kind === FixKey.ChooseTarget) {
			// the user picks the target, so open the picker for this group's first action that needs one
			const choose = group.errors.flatMap((error) => error.fixes).find((f) => f.kind === FixKey.ChooseTarget && canApplyFix(f));
			if (choose?.kind === FixKey.ChooseTarget) openTargetPicker(choose.location);
			return;
		}
		setFixing(true);
		try {
			await applyToGroup(group.message, fix);
		} finally {
			setFixing(false);
		}
	};

	return (
		<>
			<ModalHeader title="Fix Issues" />
			<div class="mx-3 flex flex-col gap-3 text-[#384B53]">
				<Show
					when={groups().length}
					fallback={
						<p class="rounded-sm bg-[#E4E3E7] p-3 text-center font-bold text-[#3D7A4A]">No issues detected in this timeline.</p>
					}>
					<div class="flex items-center justify-between gap-2">
						<h3 class="font-bold">{plural(groups().length, "issue")}: Might be leftovers from changing dolls or equipment.</h3>
						<Show when={autoFixable()}>
							<button
								onClick={() => void runFixAll()}
								disabled={fixing()}
								title="Applies every fix marked with this icon"
								class={`flex shrink-0 items-center gap-1.5 rounded-sm ${AUTO_COLOR} px-3 py-1 text-sm font-bold text-[#EFEFEF] shadow-sm shadow-black/50 ${
									fixing()
										? "cursor-default opacity-50"
										: "cursor-pointer outline-2 outline-transparent hover:outline-white"
								}`}>
								<span class="h-3.5 w-3.5 shrink-0">
									<Bolt />
								</span>
								Fix {autoFixable()} automatically
							</button>
						</Show>
					</div>
					<div class="flex max-h-[60vh] flex-col gap-2 overflow-y-auto rounded-sm bg-[#E4E3E7] px-2 pb-2 text-sm">
						<For each={saveIssueSections()}>
							{(section) => (
								<section class="flex flex-col gap-1.5">
									{/* sticky so the turn stays visible while scrolling through its issues */}
									<h4 class="sticky top-0 z-10 -mx-2 flex items-center justify-between bg-[#384B53] px-2 py-1 font-bold text-[#EFEFEF]">
										<span>{section.title}</span>
										<span class="text-xs font-normal">{plural(section.groups.length, "problem")}</span>
									</h4>
									<ul class="flex flex-col gap-1.5">
										<For each={section.groups}>
											{(group) => {
												const autoKeys = () => new Set(groupAutoFixes(group).map(fixKey));
												const isAuto = (fix: SaveFix) => autoKeys().has(fixKey(fix));
												// what "Fix automatically" picks comes first, then the other options in their usual order
												const fixes = () => {
													const all = [...group.autoFixes, ...group.manualFixes];
													return [...all.filter(isAuto), ...all.filter((fix) => !isAuto(fix))];
												};
												return (
													<li class="flex items-center gap-2 border-b border-[#C2C0C4] pb-1.5 last:border-b-0 last:pb-0">
														<Show when={issueSubject(group)}>
															{(subject) => (
																<img
																	src={subject().icon}
																	alt={subject().name}
																	title={subject().name}
																	class="h-8 w-8 shrink-0 rounded-full bg-[#C9C8CE] object-cover object-top"
																/>
															)}
														</Show>
														<div class="flex min-w-0 grow flex-col gap-1">
															{/* the section heading already names the turn */}
															<span>{group.reason}</span>
															<div class="flex flex-wrap items-center gap-1">
																<For each={fixes()}>
																	{(fix) => (
																		<>
																			<FixButton
																				fix={fix}
																				group={group}
																				auto={isAuto(fix)}
																				disabled={fixing()}
																				onClick={() => void runGroupFix(group, fix)}
																			/>
																			{/* the equip is blocked by full slots: let the user pick which key to swap out */}
																			<Show when={fullSlotsEquip(fix)}>
																				{(equip) => (
																					<button
																						onClick={() => {
																							// the picker highlights where this key goes and which equipped keys are safe to swap out
																							openDollKeys(equip().dollId, {
																								keyId: equip().keyId,
																								reason: group.reason,
																							});
																						}}
																						disabled={fixing()}
																						title="Opens the doll's keys with the slot to change highlighted; confirm the equipment screen to apply"
																						class={`rounded-sm bg-[#384B53] px-2 py-0.5 text-left text-xs font-bold text-[#EFEFEF] shadow-sm shadow-black/30 ${
																							fixing()
																								? "cursor-default opacity-50"
																								: "cursor-pointer outline-2 outline-transparent hover:outline-white"
																						}`}>
																						Open {getDollById(equip().dollId).name}'s equipment
																					</button>
																				)}
																			</Show>
																		</>
																	)}
																</For>
																<Show
																	when={!fixes().some((fix) => canApplyFix(fix) || fullSlotsEquip(fix))}>
																	<span class="text-xs text-[#606164] italic">
																		Cannot be automatically fixed
																	</span>
																</Show>
															</div>
														</div>
													</li>
												);
											}}
										</For>
									</ul>
								</section>
							)}
						</For>
					</div>
				</Show>
				<Show when={fixResult()}>
					<p class="text-sm font-bold">{fixResult()}</p>
				</Show>
			</div>
			<ModalFooter styles="justify-center">
				<Button onClick={() => setShowIssuesModal(false)} color="dark" design="cancel" content="Close" />
			</ModalFooter>
		</>
	);
}
