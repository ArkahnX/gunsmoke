import type { Doll, KeyId, Skill, Summon } from "../../gfl2-data/types.d";
import type { SaveV9SelectedDoll } from "../types/saves";
import { combinedDolls } from "./gameData";

type FortificationKey = 1 | 2 | 3 | 4 | 5 | 6;
const FORTIFICATION_KEYS: FortificationKey[] = [1, 2, 3, 4, 5, 6];

type Levels = Partial<Record<FortificationKey, object>>;

function isUnknownArray(value: unknown): value is unknown[] {
	return Array.isArray(value);
}

function applyOverride(merged: Record<string, unknown>, override: object, additiveKeys: readonly string[]) {
	for (const [prop, value] of Object.entries(override as Record<string, unknown>)) {
		if (value === undefined) continue;

		const existing = merged[prop];
		merged[prop] = additiveKeys.includes(prop) && isUnknownArray(existing) && isUnknownArray(value) ? [...existing, ...value] : value;
	}
}

function mergeLevels<T extends { levels?: Levels; replacedBy?: Partial<Record<KeyId, object>> }>(
	entry: T,
	fortification: number,
	keys: readonly (KeyId | "")[],
	additiveKeys: readonly string[] = []
): Omit<T, "levels" | "replacedBy"> {
	const { levels, replacedBy, ...base } = entry;
	// The base entry is the first layer, then each equipped key's replacement stacks on top in key order
	const layers: { levels?: Levels | undefined }[] = [{ ...base, levels }];
	if (replacedBy) {
		for (const key of keys) {
			if (!key) continue;
			const replacement = replacedBy[key];
			if (replacement) layers.push(replacement);
		}
	}

	const merged: Record<string, unknown> = {};
	for (const [index, layer] of layers.entries()) {
		const { levels: layerLevels, ...props } = layer;
		// A replacement is the key's version of the entry, so its props replace rather than append
		if (index === 0) Object.assign(merged, props);
		else applyOverride(merged, props, []);

		if (!layerLevels) continue;
		for (const key of FORTIFICATION_KEYS) {
			if (key > fortification) break;
			const override = layerLevels[key];
			if (override) applyOverride(merged, override, additiveKeys);
		}
	}

	return merged as Omit<T, "levels" | "replacedBy">;
}

function resolveSkill(skill: Skill, fortification: number, keys: readonly (KeyId | "")[]): Skill {
	return mergeLevels(skill, fortification, keys);
}

function resolveSummon(summon: Summon, fortification: number, keys: (KeyId | "")[], includeLocked: boolean): Summon {
	// Summon fortification overrides add skills rather than replacing them
	const merged = mergeLevels(summon, fortification, keys, ["skills"]);
	const skills = [...merged.skills];
	if (includeLocked) {
		// skills a higher fortification level would add
		for (const level of FORTIFICATION_KEYS) {
			if (level <= fortification) continue;
			for (const skill of summon.levels?.[level]?.skills ?? []) {
				if (!skills.some((s) => s.id === skill.id)) skills.push(skill);
			}
		}
	}
	// Run after the summon merge so skills added by a fortification level or key are resolved too
	return {
		...merged,
		skills: skills
			.filter((skill) => includeLocked || filterSkill(skill, keys))
			.map((skill) => resolveSkill(skill, fortification, keys)),
	};
}

function filterSkill(skill: Skill, keys: (KeyId | "")[]) {
	if (skill.requiresKey) {
		if (keys.includes(skill.requiresKey)) {
			return true;
		} else {
			return false;
		}
	}
	return true;
}

/**
 * The doll as its fortification and keys make it.
 * `includeLocked` also keeps skills that need an unequipped key or a higher fortification (for "always display skills").
 */
export function applyDollFortification(
	selectedDoll: Pick<SaveV9SelectedDoll, "id" | "fortification" | "keys">,
	includeLocked = false
): Doll {
	const doll = combinedDolls.data[selectedDoll.id];
	if (!doll) throw new Error(`Doll ${selectedDoll.id} not found`);
	const { fortification, keys } = selectedDoll;
	return {
		...doll,
		skills: doll.skills.filter((s) => includeLocked || filterSkill(s, keys)).map((skill) => resolveSkill(skill, fortification, keys)),
		summons: doll.summons.map((summon) => resolveSummon(summon, fortification, keys, includeLocked)),
	};
}
