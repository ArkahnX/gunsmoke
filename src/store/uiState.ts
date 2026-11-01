import { createMemo, createSignal } from "solid-js";
import { combinedDolls } from "./gameData";
import { Phase } from "../../gfl2-data/enums";
import { Buff, Doll, DollId, KeyId, SkillId, SummonId } from "../../gfl2-data/types";
import { SaveV9SelectedDoll } from "../types/saves";

export const [loaded, setLoaded] = createSignal(false);

export const [showDollModal, setShowDollModal] = createSignal(false);
export const [showFormationModal, setShowFormationModal] = createSignal(false);
export const [showWeaponModal, setShowWeaponModal] = createSignal(false);
export const [showKeyModal, setShowKeyModal] = createSignal(false);
export const [showBuffModal, setShowBuffModal] = createSignal(false);
export const hideFormationModal = createMemo(() => showWeaponModal() || showKeyModal());
export const [selectedDoll, setSelectedDoll] = createSignal<SaveV9SelectedDoll | null>(null);
/** Set when the key picker is opened from an issue: the key the doll needs and why, so its slot and tile are highlighted */
export const [keyFocus, setKeyFocus] = createSignal<{ dollId: DollId; keyId: KeyId; reason: string } | null>(null);
export const [showImportModal, setShowImportModal] = createSignal(false);
export const [showExportModal, setShowExportModal] = createSignal(false);
export const [showSkillDisplayModal, setShowSkillDisplayModal] = createSignal(false);
export const [showIssuesModal, setShowIssuesModal] = createSignal(false);
export const [showEffectModal, setShowEffectModal] = createSignal(false);
export const [effectModalEffects, setEffectModalEffects] = createSignal<Buff[]>([]);
export const [effectModalPosition, setEffectModalPosition] = createSignal({ x: 0, y: 0 });
export const [showTargetModal, setShowTargetModal] = createSignal(false);
export const [targetSkillInfo, setTargetSkillInfo] = createSignal("");
export const [targetDollId, setTargetDollId] = createSignal<DollId | SummonId | null>(null);
export const [targetSkillId, setTargetSkillId] = createSignal<SkillId | null>(null);
/** Set when the target modal replaces an existing action's target (issues modal) instead of recording a new action */
export const [retargetAction, setRetargetAction] = createSignal<{ tab: number; ownerId: DollId | SummonId; index: number } | null>(null);
export const [activePhaseTab, setActivePhaseTab] = createSignal<Phase>(Phase.All);
export const [dollFortification, setDollFortification] = createSignal<Record<string, number>>({});
export const [stateHashMatch, setStateHashMatch] = createSignal(false);
export const [stateFromURL, setStateFromURL] = createSignal(false);

export interface ImportErrorReport {
	/** What happened, for the user */
	message: string;
	/** Debug details to copy and send */
	details: string;
}
export const [importErrors, setImportErrors] = createSignal<ImportErrorReport[]>([]);

export function pushImportError(report: ImportErrorReport) {
	setImportErrors((reports) => [...reports, report]);
}

export const [zoom, setZoom] = createSignal(2.0);
export const [coords, setCoords] = createSignal("");
export const [offsetX, setOffsetX] = createSignal(0);
export const [offsetY, setOffsetY] = createSignal(0);

export function isVisible(phase: Phase): boolean {
	return (
		activePhaseTab() === Phase.All || phase === activePhaseTab() || (phase === Phase.Resonance && activePhaseTab() !== Phase.Physical)
	);
}

export function visibleDollIndex(doll: Doll) {
	const dolls = Object.values(combinedDolls.data).filter((d) => isVisible(d.phase));
	const index = dolls.findIndex((d) => d.id === doll.id);
	if (index === -1) return Object.values(combinedDolls.data).length;
	return index;
}
