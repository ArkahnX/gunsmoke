import { KeyType, Rarity } from "../../gfl2-data/enums";
import { DollId, Key, KeyId } from "../../gfl2-data/types";
import { getKeyById, getSelectedDoll, hasExpansionKey } from "./gameData";
import { log } from "../log";
import { SaveV9SelectedDoll } from "../types/saves";
import { EXTRA_KEY_COPIES, KEY_SLOTS } from "../types/constants";
import { isRenderable } from "./validation";
import { LocationKey } from "../types/issues";

export const keyMapping = KEY_SLOTS;

/**
 * How many dolls can have `key` equipped at once (the copies the player owns), or undefined when any number can. The one
 * place the limit is read, so per-key or per-plan copy counts can be added here later.
 */
export function maxKeyHolders(key: Key): number | undefined {
	const extra = EXTRA_KEY_COPIES[key.type];
	return extra === undefined ? undefined : 1 + extra;
}

/**
 * The dolls using the player's copies of `keyId`: each doll in `team` with it equipped, once, except the borrowed doll,
 * whose keys are someone else's.
 */
export function keyHolders(team: SaveV9SelectedDoll[], keyId: KeyId): DollId[] {
	return team.filter((sd) => !sd.borrow && sd.keys.includes(keyId)).map((sd) => sd.id);
}

export function displaySmallKeys(selectedDoll: SaveV9SelectedDoll) {
	const blankCommonKey = { type: KeyType.CommonKey, rarity: Rarity.ExquisiteCurios };
	const blankFixedKey = { type: KeyType.FixedKey, rarity: Rarity.ExquisiteCurios };
	const doll = getSelectedDoll(selectedDoll);
	const result = [];
	const sortedKeys = sortDisplayEquippedKeys(selectedDoll);
	for (const [index, keyType] of keyMapping.entries()) {
		const keyInfo = sortedKeys[index];
		if (keyType === KeyType.ExpansionKey) result.push("=");
		if (!hasExpansionKey(doll) && keyType === KeyType.ExpansionKey) continue;
		if (keyInfo === null) {
			if (keyType === KeyType.FixedKey || keyType === KeyType.ExpansionKey) result.push(blankFixedKey);
			else if (keyType === KeyType.CommonKey || keyType === KeyType.AffinityKey) result.push(blankCommonKey);
		} else {
			result.push(keyInfo);
		}
		if (keyType === KeyType.AffinityKey) result.push("=");
	}
	return result;
}

export function sortEquippedKeys(selectedDoll: SaveV9SelectedDoll): KeyId[] {
	const result = Array(keyMapping.length).fill("") as KeyId[];
	const doll = getSelectedDoll(selectedDoll);
	let fixedKeyIndex = keyMapping.indexOf(KeyType.FixedKey);
	let commonKeyIndex = keyMapping.indexOf(KeyType.CommonKey);
	const expansionKeyIndex = keyMapping.indexOf(KeyType.ExpansionKey);
	const affinityKeyIndex = keyMapping.indexOf(KeyType.AffinityKey);
	for (const [index, _keyType] of keyMapping.entries()) {
		const keyId = selectedDoll.keys[index] ?? "";
		if (keyId === "") {
			continue;
		}
		if (!isRenderable({ kind: LocationKey.DollKey, dollId: selectedDoll.id, keyId })) continue;
		const keyInfo = getKeyById(keyId);
		if (keyInfo.type === KeyType.FixedKey) {
			result[fixedKeyIndex] = keyId;
			fixedKeyIndex += 1;
			continue;
		} else if (keyInfo.type === KeyType.CommonKey) {
			result[commonKeyIndex] = keyId;
			commonKeyIndex += 1;
			continue;
		} else if (keyInfo.type === KeyType.AffinityKey) {
			result[affinityKeyIndex] = keyId;
			continue;
		} else if (keyInfo.type === KeyType.ExpansionKey) {
			result[expansionKeyIndex] = keyId;
			continue;
		} else {
			log.error(`${doll.name}'s key "${keyInfo.name}" (${keyId}) has an unknown key type (${String(keyInfo.type)})`);
		}
	}
	return result;
}

export function getPreSortedKeyInfo(selectedDoll: SaveV9SelectedDoll, keys: KeyId[]) {
	const result = Array(keyMapping.length).fill(null) as (Key | null)[];
	const doll = getSelectedDoll(selectedDoll);
	for (const [index, keyId] of keys.entries()) {
		if (keyId === ("" as KeyId)) {
			continue;
		}
		if (!isRenderable({ kind: LocationKey.DollKey, dollId: selectedDoll.id, keyId })) continue;
		const keyInfo = getKeyById(keyId);
		if (keyInfo) {
			result[index] = keyInfo;
		} else {
			log.error(`${doll.name} has an unknown key "${keyId}"`);
		}
	}
	return result;
}

export function sortDisplayEquippedKeys(selectedDoll: SaveV9SelectedDoll) {
	const result = Array(keyMapping.length).fill(null) as (Key | null)[];
	const doll = getSelectedDoll(selectedDoll);
	let fixedKeyIndex = keyMapping.indexOf(KeyType.FixedKey);
	let commonKeyIndex = keyMapping.indexOf(KeyType.CommonKey);
	const expansionKeyIndex = keyMapping.indexOf(KeyType.ExpansionKey);
	const affinityKeyIndex = keyMapping.indexOf(KeyType.AffinityKey);
	for (const [index, _keyType] of keyMapping.entries()) {
		const keyId = selectedDoll.keys[index] ?? "";
		if (keyId === "") {
			continue;
		}
		if (!isRenderable({ kind: LocationKey.DollKey, dollId: selectedDoll.id, keyId })) continue;
		const keyInfo = getKeyById(keyId);
		if (keyInfo.type === KeyType.FixedKey) {
			result[fixedKeyIndex] = keyInfo;
			fixedKeyIndex += 1;
			continue;
		} else if (keyInfo.type === KeyType.CommonKey) {
			result[commonKeyIndex] = keyInfo;
			commonKeyIndex += 1;
			continue;
		} else if (keyInfo.type === KeyType.AffinityKey) {
			result[affinityKeyIndex] = keyInfo;
			continue;
		} else if (keyInfo.type === KeyType.ExpansionKey) {
			result[expansionKeyIndex] = keyInfo;
			continue;
		} else {
			log.error(`${doll.name}'s key "${keyInfo.name}" (${keyId}) has an unknown key type (${String(keyInfo.type)})`);
		}
	}
	return result;
}
