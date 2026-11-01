import { produce } from "solid-js/store";
import { setState, setTempSelectedDolls, state, tempSelectedDolls } from "./appState";
import { preloadCanvasImages } from "./images";
import { BuffId, Doll, DollId, KeyId, SkillId, Summon, SummonId, WeaponId } from "../../gfl2-data/types";
import { getSelectedDoll, getWeaponByDollId, hasPrefix, hasSkillFamily, resolveSkill, summonBaseIdOf } from "./gameData";
import { IdKey } from "../../gfl2-data/enums";
import { SaveV9, SaveV9Action, SaveV9SelectedDoll } from "../types/saves";
import { localStorageLoad, saveToLocalStorage } from "./storage";
import { setDollFortification, setKeyFocus, setSelectedDoll, setShowFormationModal, setShowKeyModal } from "./uiState";
import { FORTIFICATION_LEVELS, REMOLDING_LEVELS, V9_DOLL_LOADOUT_KEY, V9_END_TURN_SKILL_ID } from "../types/constants";

export function setupTempSelectedDolls() {
	setTempSelectedDolls(
		produce((selectedDolls) => {
			selectedDolls.length = 0;
			for (const doll of state.selectedDolls) {
				selectedDolls.push({
					id: doll.id,
					fortification: doll.fortification,
					keys: [...doll.keys],
					remoldingLvl: doll.remoldingLvl,
					gun: doll.gun,
					borrow: doll.borrow ?? false,
				});
			}
		})
	);
}

/** Opens the formation (equipment) modal on a fresh copy of the team; changes apply when it's confirmed. */
export function openFormation() {
	setupTempSelectedDolls();
	// seed the fortification counters with the current team's
	setDollFortification(Object.fromEntries(state.selectedDolls.map((d) => [d.id, d.fortification])));
	setShowFormationModal(true);
}

/**
 * Opens the formation modal with the doll's key picker on top, e.g. to free a slot for a key the timeline needs. `need`
 * names that key and why, so the picker highlights where it goes and which equipped keys are safe to swap out.
 */
export function openDollKeys(dollId: DollId, need?: { keyId: KeyId; reason: string }) {
	openFormation();
	const doll = tempSelectedDolls.find((d) => d.id === dollId);
	if (!doll) return;
	setKeyFocus(need ? { dollId, ...need } : null);
	setSelectedDoll(doll);
	setShowKeyModal(true);
}

export function removeDollFromTempSelect(dollId: DollId) {
	setTempSelectedDolls(
		produce((selectedDolls) => {
			const index = selectedDolls.findIndex((doll) => doll.id === dollId);
			if (index > -1) {
				selectedDolls.splice(index, 1);
			}
		})
	);
}

/** A newly added doll's loadout: V0, no keys, lowest remolding, signature weapon. */
export function defaultLoadout(dollId: DollId): SaveV9SelectedDoll {
	return {
		id: dollId,
		fortification: 0,
		keys: Array(8).fill("") as KeyId[],
		remoldingLvl: REMOLDING_LEVELS[0],
		gun: getWeaponByDollId(dollId).id,
		borrow: false,
	};
}

export function addDollToTempSelect(dollId: DollId) {
	setTempSelectedDolls(
		produce((selectedDolls) => {
			selectedDolls.push(defaultLoadout(dollId));
		})
	);
}

export function setDollWeapon(dollId: DollId, weaponId: WeaponId | null) {
	if (!weaponId || !dollId) return;
	setTempSelectedDolls(
		produce((selectedDolls) => {
			for (const doll of selectedDolls) {
				if (doll.id === dollId) {
					doll.gun = weaponId;
				}
			}
		})
	);
}

export function setBuffs(buffIds: BuffId[]) {
	setState(
		produce((s) => {
			s.buffs.length = 0;
			s.buffs.push(...buffIds);
		})
	);
	saveToLocalStorage();
}

export function setDollKeys(dollId: DollId, keys: KeyId[]) {
	if (!dollId) return;
	setTempSelectedDolls(
		produce((selectedDolls) => {
			for (const doll of selectedDolls) {
				if (doll.id === dollId) {
					doll.keys.length = 0;
					doll.keys.push(...keys);
				}
			}
		})
	);
}

export function changeFortification(dollId: DollId, fort: number) {
	setTempSelectedDolls(
		produce((tempSelected) => {
			const index = tempSelected.findIndex((d) => d.id === dollId);
			if (index !== -1) {
				const lowest = FORTIFICATION_LEVELS[0];
				const highest = FORTIFICATION_LEVELS[FORTIFICATION_LEVELS.length - 1];
				tempSelected[index].fortification = Math.min(highest, Math.max(lowest, tempSelected[index].fortification + fort));
			}
		})
	);
}

export function changeBorrow(dollId: DollId) {
	setTempSelectedDolls(
		produce((tempSelected) => {
			for (const doll of tempSelected) {
				doll.borrow = false;
				if (doll.id === dollId) {
					doll.borrow = !doll.borrow;
				}
			}
		})
	);
}

export function changeRemoldingLvl(dollId: DollId, modifier: number) {
	const remoldingLevels = REMOLDING_LEVELS;
	setTempSelectedDolls(
		produce((tempSelected) => {
			const index = tempSelected.findIndex((d) => d.id === dollId);
			if (index !== -1) {
				let currentLvl = remoldingLevels.indexOf(tempSelected[index].remoldingLvl);
				currentLvl += modifier;
				currentLvl = Math.max(0, currentLvl);
				currentLvl = Math.min(remoldingLevels.length - 1, currentLvl);
				tempSelected[index].remoldingLvl = remoldingLevels[currentLvl];
			}
		})
	);
}

export function saveDollLoadout(dollId: DollId) {
	const index = tempSelectedDolls.findIndex((d) => d.id === dollId);
	if (index !== -1) {
		const doll = tempSelectedDolls[index];
		localStorage.setItem(V9_DOLL_LOADOUT_KEY(dollId), JSON.stringify(doll));
	}
}

export function loadDollLoadout(dollId: DollId) {
	const loadout = localStorageLoad(V9_DOLL_LOADOUT_KEY(dollId)) as SaveV9SelectedDoll | null;
	setTempSelectedDolls(
		produce((selectedDolls) => {
			for (const doll of selectedDolls) {
				if (doll.id === dollId && loadout) {
					doll.fortification = loadout.fortification;
					doll.keys = [...loadout.keys];
					doll.remoldingLvl = loadout.remoldingLvl;
					doll.gun = loadout.gun;
					doll.borrow = loadout.borrow ?? false;
				}
			}
		})
	);
}

export function dollHasLoadout(dollId: DollId): boolean {
	return localStorage.getItem(V9_DOLL_LOADOUT_KEY(dollId)) !== null;
}

export function defaultActionOrder(tabIndex: number) {
	if (tabIndex < 0 || tabIndex > 7) return;
	const oldOrder = state.tabData[tabIndex].actionOrder ?? [];
	const order = new Set(oldOrder);
	const unique = new Set();
	setState(
		produce((s) => {
			// const turn = s.tabData[tabIndex];
			for (const doll of s.selectedDolls) {
				order.add(doll.id);
				unique.add(doll.id);
				const dollInfo = getSelectedDoll(doll);
				for (const summon of dollInfo.summons) {
					order.add(summon.id);
					unique.add(summon.id);
				}
			}
			for (const dollId of order) {
				if (!unique.has(dollId)) {
					order.delete(dollId);
				}
			}
			s.tabData[tabIndex].actionOrder = Array.from(order);
		})
	);
}

/** Base id -> id currently in use, for every selected doll and their summons (summon ids change with fortification and keys). */
function currentIdsByBase(dolls: SaveV9SelectedDoll[]): Map<DollId | SummonId, DollId | SummonId> {
	const ids = new Map<DollId | SummonId, DollId | SummonId>();
	for (const doll of dolls) {
		ids.set(doll.id, doll.id);
		for (const summon of getSelectedDoll(doll).summons) ids.set(summonBaseIdOf(summon.id), summon.id);
	}
	return ids;
}

/** Sets the team, moving the timeline's ids onto the new loadouts (see `applySelectedDolls`). */
export function changeSelectedDolls(newDolls: SaveV9SelectedDoll[]) {
	setState(
		produce((s) => {
			applySelectedDolls(s, newDolls);
		})
	);
}

/**
 * Sets `timeline`'s team to `newDolls` in place: removed dolls' entries go, added ones get empty entries, and summon and
 * skill ids move to the versions the new fortification and keys give. Works on any copy of a timeline, so a loadout
 * change can be previewed (see `keySwapImpact`).
 */
export function applySelectedDolls(timeline: SaveV9, newDolls: SaveV9SelectedDoll[]) {
	// Compare by base id, so a summon swapping to another tier or key variant is renamed rather than removed and re-added
	const oldIds = currentIdsByBase(timeline.selectedDolls);
	const newIds = currentIdsByBase(newDolls);
	const removed = [...oldIds].filter(([base]) => !newIds.has(base)).map(([, id]) => id);
	const added = [...newIds].filter(([base]) => !oldIds.has(base)).map(([, id]) => id);
	const renamed = new Map<DollId | SummonId, DollId | SummonId>();
	for (const [base, oldId] of oldIds) {
		const newId = newIds.get(base);
		if (newId !== undefined && newId !== oldId) renamed.set(oldId, newId);
	}
	const rename = <T extends DollId | SummonId>(id: T): T => (renamed.get(id) ?? id) as T;

	// Entities as the old and new loadouts make them, to move recorded skills (doll and summon) onto their new tier/key
	// variant. Locked skills are included so a skill still waiting on a key or fortification gets its new id too.
	const entitiesOf = (dolls: SaveV9SelectedDoll[]) => {
		const entities = new Map<DollId | SummonId, Doll | Summon>();
		for (const doll of dolls) {
			const resolved = getSelectedDoll(doll, true);
			entities.set(doll.id, resolved);
			for (const summon of resolved.summons) entities.set(summon.id, summon);
		}
		return entities;
	};
	const oldEntities = entitiesOf(timeline.selectedDolls);
	const newEntities = entitiesOf(newDolls);
	/** Whether `skillId` is the version `owner`'s loadout gives, rather than one saved for another loadout. */
	const isCurrent = (skillId: SkillId, owner: Doll | Summon | undefined) =>
		!!owner && hasSkillFamily(skillId, owner) && resolveSkill(skillId, owner).id === skillId;
	const resolveAction = (oldOwnerId: DollId | SummonId, ownerId: DollId | SummonId, [skillId, targetId]: SaveV9Action): SaveV9Action => {
		const owner = newEntities.get(ownerId);
		// only skills that matched the old loadout follow the change; a version that already needed another loadout (a
		// key or fortification it lacks) is kept as-is, so validateSave keeps reporting it instead of it being swapped
		// for another version just by confirming the equipment
		const skill =
			skillId !== V9_END_TURN_SKILL_ID && isCurrent(skillId, oldEntities.get(oldOwnerId)) && owner && hasSkillFamily(skillId, owner)
				? resolveSkill(skillId, owner).id
				: skillId;
		return targetId === undefined ? [skill] : [skill, rename(targetId)];
	};

	timeline.selectedDolls.length = 0;
	timeline.selectedDolls.push(...newDolls);
	for (let tabIndex = 0; tabIndex < 8; tabIndex++) {
		const tab = timeline.tabData[tabIndex];
		for (const dollId of removed) {
			if (dollId in tab.dollPositions && hasPrefix(dollId, IdKey.Dolls)) {
				// eslint-disable-next-line @typescript-eslint/no-dynamic-delete
				delete tab.dollPositions[dollId];
			}
			// eslint-disable-next-line @typescript-eslint/no-dynamic-delete
			delete tab.actions[dollId];
			const orderIndex = tab.actionOrder.indexOf(dollId);
			if (orderIndex !== -1) tab.actionOrder.splice(orderIndex, 1);
			tab.summonPositions = tab.summonPositions.filter((p) => p.id !== dollId);
		}
		tab.actionOrder = tab.actionOrder.map(rename);
		tab.summonPositions = tab.summonPositions.map((p) => ({ ...p, id: rename(p.id) }));
		tab.actions = Object.fromEntries(
			Object.entries(tab.actions).map(([ownerKey, actions]) => {
				const oldOwnerId = ownerKey as DollId | SummonId;
				const ownerId = rename(oldOwnerId);
				return [ownerId, actions.map((action) => resolveAction(oldOwnerId, ownerId, action))];
			})
		);
		for (const dollId of added) {
			if (hasPrefix(dollId, IdKey.Dolls)) {
				tab.dollPositions[dollId] = { x: -1, y: -1 };
			}
			tab.actions[dollId] ??= [];
			if (!tab.actionOrder.includes(dollId)) tab.actionOrder.push(dollId);
		}
	}
	if (added.length || removed.length) {
		// reset score and description if present when dolls change, as that's likely a new team
		timeline.score = 0;
		timeline.description = "";
	}
	return { added, removed, renamed: Object.fromEntries(renamed) };
}

export async function updateSelectedDolls() {
	changeSelectedDolls([...tempSelectedDolls]);
	await preloadCanvasImages();
	for (let i = 0; i < 8; i++) defaultActionOrder(i);
	saveToLocalStorage();
}
