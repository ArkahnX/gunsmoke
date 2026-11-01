import { state } from "../store/appState";
import { getDollByDollOrSummon, getSelectedDoll, getSummonById } from "../store/gameData";
import { getBoss, gridKey, isTileType, mapGrid } from "../store/mapGrid";
import { getDollStartingPosition } from "../store/placement";
import { DragState, MapDollInfo, TileType } from "../types";
import { isRenderable } from "../store/validation";
import { LocationKey } from "../types/issues";

function obscured(x: number, y: number, dollId: string, instanceId: string | null, dollGrid?: MapDollInfo[]) {
	const tileBelow = mapGrid.tiles[gridKey(x, y + 1)];
	const currentTile = mapGrid.tiles[gridKey(x, y)];
	// if there is a boundary below
	if (currentTile && tileBelow && isTileType(currentTile, TileType.HBoundary) && isTileType(tileBelow, TileType.HBoundary)) return true;

	// if there is a solid tile below
	if (tileBelow) {
		if (
			isTileType(tileBelow, TileType.BossCover) ||
			isTileType(tileBelow, TileType.BossOrigin) ||
			isTileType(tileBelow, TileType.HalfCover) ||
			isTileType(tileBelow, TileType.FullCover)
		)
			return true;
	}
	// if there is a doll below
	if (dollGrid) {
		const doll = dollGrid.find((doll) => doll.x === x && doll.y === y + 1);
		if (doll) return true;
	}
	return false;
}

function distance(dollGrid: MapDollInfo[]) {
	const bossCoords = getBoss();
	let min = Infinity;
	let minDoll: MapDollInfo | null = null;
	let max = -Infinity;
	let maxDoll: MapDollInfo | null = null;
	for (const doll of dollGrid) {
		// summons cannot be considered for distance calculations
		if (doll.instanceId) continue;
		const dist = Math.abs(doll.x - bossCoords.x) + Math.abs(doll.y - bossCoords.y);
		const isMinHigherPriority = () => doll.priority < (minDoll?.priority ?? Infinity) || doll.borrow;
		const isMaxHigherPriority = () => doll.priority < (maxDoll?.priority ?? Infinity) || doll.borrow;

		if (dist < min || (dist === min && isMinHigherPriority())) {
			min = dist;
			minDoll = doll;
		}
		if (dist > max || (dist === max && isMaxHigherPriority())) {
			max = dist;
			maxDoll = doll;
		}
	}
	if (minDoll) minDoll.distance = "near";
	if (maxDoll) maxDoll.distance = "far";
}

export function getDollData(drag: DragState | null, currentTab: number) {
	const dolls: MapDollInfo[] = [];
	state.selectedDolls.forEach((doll) => {
		const pos = state.tabData[currentTab]?.dollPositions[doll.id] ?? { x: -1, y: -1 };
		const oldPos = state.tabData[currentTab - 1]?.dollPositions[doll.id] ?? { x: -1, y: -1 };
		if (pos.x === -1 || pos.y === -1) return;
		const spawnPosition = getDollStartingPosition(doll.id);
		const priorityIndex = mapGrid.priority.indexOf(spawnPosition);
		dolls.push({
			x: pos.x,
			y: pos.y,
			oldX: oldPos.x,
			oldY: oldPos.y,
			id: doll.id,
			instanceId: null,
			priority: priorityIndex !== -1 ? priorityIndex : mapGrid.priority.length,
			dollInfo: getSelectedDoll(doll),
			summonInfo: null,
			dragId: drag?.isActive ? drag.id : undefined,
			dragInstanceId: drag?.isActive ? drag.instanceId : null,
			obscured: obscured(pos.x, pos.y, doll.id, null),
			borrow: doll.borrow || false,
			distance: null,
		});
	});
	if (currentTab >= 1) {
		state.tabData[currentTab].summonPositions.forEach((entry, index) => {
			if (!isRenderable({ kind: LocationKey.SummonPosition, tab: currentTab, index })) return;
			const summon = getSummonById(entry.id);
			const oldSummonPosition = state.tabData[currentTab - 1]?.summonPositions.find((e) => e.mapId === entry.mapId);
			dolls.push({
				x: entry.x,
				y: entry.y,
				oldX: oldSummonPosition?.x ?? -1,
				oldY: oldSummonPosition?.y ?? -1,
				id: entry.id,
				instanceId: entry.mapId,
				priority: mapGrid.priority.length,
				dollInfo: getDollByDollOrSummon(summon),
				summonInfo: summon,
				dragId: drag?.isActive ? drag.id : undefined,
				dragInstanceId: drag?.isActive ? drag.instanceId : null,
				obscured: obscured(entry.x, entry.y, entry.id, entry.mapId),
				borrow: false,
				distance: null,
			});
		});
	}
	for (const [_grid, entry] of Object.entries(dolls)) {
		entry.obscured = obscured(entry.x, entry.y, entry.id, entry.instanceId, dolls);
	}
	distance(dolls);
	return dolls;
}
