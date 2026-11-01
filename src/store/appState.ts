import { createStore } from "solid-js/store";
import { SkillMode, SkillType, SkillTypeLabels } from "../../gfl2-data/enums";
import { SaveV9, SaveV9SelectedDoll, SaveV9TabData } from "../types/saves";
import { LocalState } from "../types";
import { V9_END_TURN_SKILL_ID } from "../types/constants";
import { Skill } from "../../gfl2-data/types";

export const skillOrder = [
	SkillType.BasicAttack,
	SkillType.Skill1,
	SkillType.Skill2,
	SkillType.Ultimate,
	SkillType.Passive,
	SkillType.SkillA,
	SkillType.SkillB,
	SkillType.SkillC,
	SkillType.SkillE,
	SkillType.FixedKey,
	SkillType.SelfPassive,
	SkillType.EndTurn,
	SkillType.Move,
];

/**
 * Notation styles per skill type. The insertion order is the persisted layout of `localState.skillDisplay`
 * (slot i holds the chosen style of the i-th type) and matches v7/v8 for the first 9 types, so only ever append new
 * types to the end. A Map keeps insertion order; a plain object would sort the numeric SkillType keys instead.
 * Display order comes from `skillOrder`, which can be rearranged freely.
 */
export const notations = new Map<SkillType, string[]>([
	[SkillType.BasicAttack, ["S1", "1", "BA"]],
	[SkillType.Skill1, ["S2", "2", "S1"]],
	[SkillType.Skill2, ["S3", "3", "S2"]],
	[SkillType.Ultimate, ["S4", "4", "ULT"]],
	[SkillType.Passive, ["S5", "5", "PSV"]],
	[SkillType.SkillA, ["S6", "6", "SA", "1"]],
	[SkillType.SkillB, ["S7", "7", "SB", "2"]],
	[SkillType.EndTurn, ["ET", "Z", "END"]],
	[SkillType.Move, ["MV", "W", "MOVE", "MOV"]],
	[SkillType.SkillC, []],
	[SkillType.SkillE, []],
	[SkillType.FixedKey, []],
	[SkillType.SelfPassive, []],
]);

const notationSlots = new Map([...notations.keys()].map((type, slot) => [type, slot]));

/** Index of the skill type's chosen style in `localState.skillDisplay`. */
export function getNotationSlot(type: SkillType): number {
	const slot = notationSlots.get(type);
	if (slot === undefined) throw new Error(`No notation slot for skill type ${SkillTypeLabels[type]}`);
	return slot;
}

export function getNotations(type: SkillType): string[] {
	const styles = notations.get(type);
	if (!styles) throw new Error(`No notations for skill type ${SkillTypeLabels[type]}`);
	return styles;
}

export const endTurnSkill: Skill = {
	id: V9_END_TURN_SKILL_ID,
	name: SkillTypeLabels[SkillType.EndTurn],
	type: SkillType.EndTurn,
	damage: [],
	selects: [],
	affects: [],
	range: "",
	// not a game-data skill; matches how the data describes skills that only affect their user
	shape: "Target",
	mode: SkillMode.SingleTarget,
	tags: [],
	icon: "vectors/end.svg",
};

/** First `s<n>` not used by any summon placement on any turn, so instance ids stay unique across the timeline. */
export function nextSummonInstanceId(tabs: SaveV9TabData[]): string {
	const used = new Set(tabs.flatMap((tab) => tab.summonPositions.map((p) => p.mapId)));
	let n = 0;
	while (used.has(`s${n}`)) n++;
	return `s${n}`;
}

export function makeDefaultTabData(): SaveV9TabData {
	return { actionOrder: [], actions: {}, dollPositions: {}, summonPositions: [] };
}

export const [tempSelectedDolls, setTempSelectedDolls] = createStore<SaveV9SelectedDoll[]>([]);

export const defaultState: SaveV9 = {
	version: 9,
	selectedDolls: [],
	score: 0,
	description: "",
	map: "Broken-Horn Beasteel",
	buffs: [],
	tabData: Array.from({ length: 8 }, () => makeDefaultTabData()),
};

export const [state, setState] = createStore<SaveV9>(structuredClone(defaultState));

export const defaultLocalState: LocalState = {
	alwaysDisplaySkills: true,
	currentTab: 0,
	skillDisplay: new Array(notations.size).fill(0) as number[],
	exportIncludeDolls: false,
	exportDiscord: false,
	exportAsLink: false,
	exportIncludeSeason: false,
	exportIncludeBoss: false,
};

export const [localState, setLocalState] = createStore<LocalState>(structuredClone(defaultLocalState));
