import { produce } from "solid-js/store";
import { DragState, Position } from "../types";
import { localState, setState, state } from "./appState";
import { gridKey } from "./mapGrid";
import { DollId, SummonId } from "../../gfl2-data/types";
import { hasPrefix } from "./gameData";
import { IdKey } from "../../gfl2-data/enums";
import { saveToLocalStorage } from "./storage";

export function getDollStartingPosition(dollId: DollId): number {
	const dollPos = state.tabData[0].dollPositions[dollId];
	return gridKey(dollPos?.x ?? -1, dollPos?.y ?? -1);
}

export function isPlaced(dollId: DollId | SummonId, tab = localState.currentTab): boolean {
	if (hasPrefix(dollId, IdKey.Summons)) {
		for (const p of state.tabData[tab].summonPositions) {
			if (p.id === dollId) return true;
		}
	} else if (hasPrefix(dollId, IdKey.Dolls)) {
		const pos = state.tabData[tab].dollPositions[dollId];
		return !!pos && pos.x > -1;
	} else {
		throw new Error(`Unknown doll/summon id: ${String(dollId)}`);
	}
	return false;
}

export function getPositionsForDoll(dollId: DollId | SummonId): Position[] {
	const positions: Position[] = [];
	if (hasPrefix(dollId, IdKey.Summons)) {
		for (const p of state.tabData[localState.currentTab].summonPositions) {
			if (p.id === dollId) positions.push({ x: p.x, y: p.y });
		}
	} else if (hasPrefix(dollId, IdKey.Dolls)) {
		const pos = state.tabData[localState.currentTab].dollPositions[dollId];
		if (pos) positions.push(pos);
	} else {
		throw new Error(`Unknown doll/summon id: ${String(dollId)}`);
	}
	return positions;
}

export function getDollPosition(dollId: DollId | SummonId, instanceId: string | null): Position | null {
	if (hasPrefix(dollId, IdKey.Summons)) {
		for (const p of state.tabData[localState.currentTab].summonPositions) {
			if (p.id === dollId && p.mapId === instanceId) return { x: p.x, y: p.y };
		}
	} else if (hasPrefix(dollId, IdKey.Dolls)) {
		const pos = state.tabData[localState.currentTab].dollPositions[dollId];
		if (pos) return pos;
	} else {
		throw new Error(`Unknown doll/summon id: ${String(dollId)}`);
	}
	return null;
}

export function placeDoll(id: DollId, x: number, y: number) {
	setState(
		produce((s) => {
			s.tabData[localState.currentTab].dollPositions[id] = { x, y };
		})
	);
	saveToLocalStorage();
}

export function placeSummon(summonId: SummonId, mapId: string, x: number, y: number) {
	if (!mapId) throw new Error(`No instanceId for summon: ${summonId}`);
	setState(
		produce((s) => {
			const positions = s.tabData[localState.currentTab].summonPositions;
			const existing = positions.find((p) => p.mapId === mapId && p.id === summonId);
			if (existing) {
				existing.x = x;
				existing.y = y;
			} else {
				for (const p of positions) {
					if (p.x === x && p.y === y) return;
				}
				positions.push({ id: summonId, mapId, x: x, y: y });
			}
		})
	);
	saveToLocalStorage();
}

export function swapPositions(
	id: DollId | SummonId,
	instanceId: string | null,
	x: number,
	y: number,
	swapDoll: Omit<DragState, "screenX" | "screenY" | "isActive" | "status"> | null
) {
	if (!swapDoll) return;
	setState(
		produce((s) => {
			const oldPosition = getDollPosition(id, instanceId);
			// place new doll
			if (hasPrefix(id, IdKey.Dolls)) {
				s.tabData[localState.currentTab].dollPositions[id] = { x: x, y: y };
			} else if (hasPrefix(id, IdKey.Summons)) {
				if (!instanceId) throw new Error(`No instanceId for summon: ${id}`);
				const positions = s.tabData[localState.currentTab].summonPositions;
				const existing = positions.find((p) => p.mapId === instanceId && p.id === id);
				if (existing) {
					existing.x = x;
					existing.y = y;
				} else {
					positions.push({ id: id, mapId: instanceId, x: x, y: y });
				}
			} else {
				throw new Error(`Unknown doll/summon id: ${String(id)}`);
			}
			if (oldPosition) {
				// move old doll
				if (hasPrefix(swapDoll.id, IdKey.Dolls)) {
					s.tabData[localState.currentTab].dollPositions[swapDoll.id] = { x: oldPosition.x, y: oldPosition.y };
				} else if (hasPrefix(swapDoll.id, IdKey.Summons)) {
					const positions = s.tabData[localState.currentTab].summonPositions;
					const existing = positions.find((p) => p.mapId === swapDoll.instanceId && p.id === swapDoll.id);
					if (existing) {
						existing.x = oldPosition.x;
						existing.y = oldPosition.y;
					}
				} else {
					throw new Error(`Unknown doll/summon id: ${String(swapDoll.id)}`);
				}
			} else {
				// if the doll we are trying to place did not have a prior position, remove the swap doll
				if (hasPrefix(swapDoll.id, IdKey.Dolls)) {
					s.tabData[localState.currentTab].dollPositions[swapDoll.id] = { x: -1, y: -1 };
				} else if (hasPrefix(swapDoll.id, IdKey.Summons)) {
					const positions = s.tabData[localState.currentTab].summonPositions;
					const existing = positions.find((p) => p.mapId === swapDoll.instanceId && p.id === swapDoll.id);
					if (existing) {
						positions.splice(positions.indexOf(existing), 1);
					}
				} else {
					throw new Error(`Unknown doll/summon id: ${String(swapDoll.id)}`);
				}
			}
		})
	);
	saveToLocalStorage();
}

export function removeDollOrSummon(id?: DollId | SummonId, instanceId?: string | null) {
	if (!id) return;
	if (hasPrefix(id, IdKey.Dolls)) {
		setState(
			produce((s) => {
				s.tabData[localState.currentTab].dollPositions[id] = { x: -1, y: -1 };
			})
		);
		saveToLocalStorage();
	} else if (hasPrefix(id, IdKey.Summons)) {
		setState(
			produce((s) => {
				const positions = s.tabData[localState.currentTab].summonPositions;
				const existing = positions.find((p) => p.mapId === instanceId && p.id === id);
				if (existing) {
					positions.splice(positions.indexOf(existing), 1);
				}
			})
		);
		saveToLocalStorage();
	} else {
		throw new Error(`Unknown doll/summon id: ${String(id)}`);
	}
}
