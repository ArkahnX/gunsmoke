import { expandRichText, IdKey, Rarity } from "../../gfl2-data/enums";
import { Buff, BuffId, Skill } from "../../gfl2-data/types";
import { SaveV9Action } from "../types/saves";
import { DollId, SummonId } from "../../gfl2-data/types";
import { isRenderable } from "./validation";
import { getBuffById, getEntityById, getSkillById, getSkillDisplay } from "./gameData";
import { LocationKey } from "../types/issues";

const buffRegex = new RegExp(`\\{(${IdKey.Buffs}[0-9a-z]+)\\}`, "gi");

export const interactiveStyles = (selected: boolean | null | undefined = false) =>
	"cursor-pointer outline-3 transition transition-discrete duration-175 hover:scale-107 hover:outline-white " +
	(selected === true ? "outline-[#F26C1C]" : selected === null ? "outline-transparent" : "outline-transparent");

export const rarityBorderColor = (rarity: Rarity) =>
	rarity === Rarity.Elite ? "border-[#DF9E00]" : rarity === Rarity.Standard ? "border-[#7968BA]" : "border-[#3291AB]";

export const rarityGradientColor = (rarity: Rarity) =>
	rarity === Rarity.Elite ? "from-[#453824]" : rarity === Rarity.Standard ? "from-[#272B40]" : "from-[#133843]";

function getBuffName(id: BuffId): string {
	const buff = getBuffById(id);
	return buff.name;
}

export const parseEffects = (description: string) => {
	return expandRichText(description).replace(buffRegex, (match: string, buffId: BuffId) => {
		return `<span class="font-bold underline text-[#4FA8E8] cursor-pointer hover:text-[#7DC0F5]" data-effect-id="${buffId}">${getBuffName(buffId)}</span>`;
	});
};

export function formatEffectDescription(description: string): string {
	return description.replace(
		buffRegex,
		(match: string, id: BuffId) => `<span class="font-semibold text-[#4FA8E8]">${getBuffName(id)}</span>`
	);
}

export function getReferencedEffects(rootBuffId: BuffId) {
	const seen = new Set<BuffId>();
	const result: Buff[] = [];
	const queue = [rootBuffId];
	while (queue.length) {
		const id = queue.shift();
		if (id === undefined) continue;
		if (seen.has(id)) continue;
		seen.add(id);
		const buff = getBuffById(id);
		result.push(buff);
		const regexMatch = [...buff.description.matchAll(buffRegex)];
		queue.push(...regexMatch.map((match) => match[1] as BuffId));
	}
	return result;
}

/** `at` identifies the action in the store so invalid entries render as "?" instead of reaching the throwing finders. */
export function renderAction(action: SaveV9Action, at: { tab: number; ownerId: DollId | SummonId; index: number }): string {
	if (!isRenderable({ kind: LocationKey.Action, ...at })) return "?";
	const [skillId, targetId] = action;
	const skill = getSkillById(skillId);
	if (targetId) {
		if (!isRenderable({ kind: LocationKey.ActionTarget, ...at })) return getSkillDisplay(skill.type) + ">?";
		const target = getEntityById(targetId);
		return getSkillDisplay(skill.type) + ">" + (target?.name ?? "?");
	}
	return getSkillDisplay(skill.type);
}

export function renderActionBySkill(skill: Skill): string {
	return getSkillDisplay(skill.type);
}
