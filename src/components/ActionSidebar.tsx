import { For, Show, createMemo, onMount } from "solid-js";
import { produce } from "solid-js/store";
import {
	state,
	setState,
	allDolls,
	allSummons,
	getDollInfoFromId,
	getSortedUsableSkills,
	isPlaced,
	getPositionsForDoll,
	getFortificationFromId,
	renderAction,
	saveToLocalStorage,
	showTargetModal,
	setShowTargetModal,
	setTargetDollId,
	setTargetSkillId,
	getDollFromSummon,
} from "../store";
import type { DollData, SummonData, SkillAction, DollRowProps } from "../types";
import SkillIcon from "./icons/SkillIcon";
import Button from "./buttons/Button";
import SquareDollChip from "./SquareDollChip";
import Modal from "./modals/Modal";
import Grip from "./icons/Grip";

let dragSrcId: string | null = null;
let draggableItem: HTMLDivElement | null = null;
let listContainer: HTMLDivElement | undefined = undefined;

let pointerStartX = 0;
let pointerStartY = 0;

let itemsGap = 0;

let items: HTMLElement[] = [];

let prevRect: DOMRect | null = null;

/***********************
 *    Helper Functions   *
 ***********************/

function getAllItems() {
	if (!items.length && listContainer) {
		items = Array.from(listContainer.querySelectorAll(".doll-row"));
	}
	return items;
}

function getIdleItems() {
	return getAllItems().filter((item) => item.classList.contains("is-idle"));
}

function isItemAbove(item: HTMLElement) {
	return item.hasAttribute("data-is-above");
}

function isItemToggled(item: HTMLElement) {
	return item.hasAttribute("data-is-toggled");
}

/***********************
 *     Drag Start      *
 ***********************/

function setItemsGap() {
	if (getIdleItems().length <= 1) {
		itemsGap = 0;
		return;
	}

	const item1 = getIdleItems()[0];
	const item2 = getIdleItems()[1];

	const item1Rect = item1.getBoundingClientRect();
	const item2Rect = item2.getBoundingClientRect();

	itemsGap = Math.abs(item1Rect.bottom - item2Rect.top);
}

function disablePageScroll() {
	document.body.style.overflow = "hidden";
	document.body.style.touchAction = "none";
	document.body.style.userSelect = "none";
}

function initItemsState() {
	getIdleItems().forEach((item, i) => {
		if (draggableItem instanceof HTMLElement) {
			if (getAllItems().indexOf(draggableItem) > i) {
				item.dataset.isAbove = "";
			}
		}
	});
}

function initDraggableItem() {
	if (!draggableItem) return;
	draggableItem.classList.remove("is-idle");
	draggableItem.classList.add("is-draggable");
}

/***********************
 *        Drag         *
 ***********************/

function drag(e: MouseEvent | TouchEvent) {
	if (!draggableItem) return;

	e.preventDefault();

	let clientX = 0;
	let clientY = 0;
	if (e instanceof MouseEvent) {
		clientX = e.clientX;
		clientY = e.clientY;
	}

	if (e instanceof TouchEvent) {
		clientX = e.touches[0].clientX;
		clientY = e.touches[0].clientY;
	}

	const pointerOffsetX = clientX - pointerStartX;
	const pointerOffsetY = clientY - pointerStartY;

	draggableItem.style.transform = `translate(${pointerOffsetX}px, ${pointerOffsetY}px)`;

	updateIdleItemsStateAndPosition();
}

function updateIdleItemsStateAndPosition() {
	if (!draggableItem) return;
	const draggableItemRect = draggableItem.getBoundingClientRect();
	const draggableItemY = draggableItemRect.top + draggableItemRect.height / 2;
	// Update state
	getIdleItems().forEach((item) => {
		const itemRect = item.getBoundingClientRect();
		const itemY = itemRect.top + itemRect.height / 2;
		if (isItemAbove(item)) {
			if (draggableItemY <= itemY) {
				item.dataset.isToggled = "";
			} else {
				delete item.dataset.isToggled;
			}
		} else {
			if (draggableItemY >= itemY) {
				item.dataset.isToggled = "";
			} else {
				delete item.dataset.isToggled;
			}
		}
	});

	// Update position
	getIdleItems().forEach((item) => {
		if (isItemToggled(item)) {
			const direction = isItemAbove(item) ? 1 : -1;
			item.style.transform = `translateY(${direction * (draggableItemRect.height + itemsGap)}px)`;
		} else {
			item.style.transform = "";
		}
	});
}

/***********************
 *      Drag End       *
 ***********************/

function applyNewItemsOrder(e: MouseEvent | TouchEvent) {
	if (!draggableItem || !listContainer) return;
	const reorderedItems: HTMLElement[] = [];

	getAllItems().forEach((item, index) => {
		if (item === draggableItem) {
			return;
		}
		if (!isItemToggled(item)) {
			reorderedItems[index] = item;
			return;
		}
		const newIndex = isItemAbove(item) ? index + 1 : index - 1;
		reorderedItems[newIndex] = item;
	});

	for (let index = 0; index < getAllItems().length; index++) {
		const item = reorderedItems[index];
		if (typeof item === "undefined") {
			reorderedItems[index] = draggableItem;
		}
	}

	setState(
		produce((s) => {
			const tab = s.tabData[s.currentTab]!;
			tab.actionOrder.length = 0;
			for (const item of reorderedItems) {
				tab.actionOrder.push(item.dataset.dollId!);
			}
		})
	);
	saveToLocalStorage();

	reorderedItems.forEach((item) => {
		listContainer.appendChild(item);
	});

	draggableItem.style.transform = "";

	requestAnimationFrame(() => {
		if (draggableItem instanceof HTMLElement && prevRect instanceof DOMRect) {
			const rect = draggableItem.getBoundingClientRect();
			const yDiff = prevRect.y - rect.y;
			let currentPositionX = 0;
			let currentPositionY = 0;
			if (e instanceof MouseEvent) {
				currentPositionX = e.clientX;
				currentPositionY = e.clientY;
			}

			if (e instanceof TouchEvent) {
				currentPositionX = e.touches[0].clientX;
				currentPositionY = e.touches[0].clientY;
			}

			const pointerOffsetX = currentPositionX - pointerStartX;
			const pointerOffsetY = currentPositionY - pointerStartY;

			draggableItem.style.transform = `translate(${pointerOffsetX}px, ${pointerOffsetY + yDiff}px)`;
		}
		requestAnimationFrame(() => {
			unsetDraggableItem();
		});
	});
}

function cleanup() {
	itemsGap = 0;
	items = [];
	unsetItemState();
	enablePageScroll();

	document.removeEventListener("mousemove", drag);
	document.removeEventListener("touchmove", drag);
}

function unsetDraggableItem() {
	if (!draggableItem) return;
	draggableItem.style = "";
	draggableItem.classList.remove("is-draggable");
	draggableItem.classList.add("is-idle");
	draggableItem = null;
}

function unsetItemState() {
	getIdleItems().forEach((item, i) => {
		delete item.dataset.isAbove;
		delete item.dataset.isToggled;
		item.style.transform = "";
	});
}

function enablePageScroll() {
	document.body.style.overflow = "";
	document.body.style.touchAction = "";
	document.body.style.userSelect = "";
}

function handleSkillClick(dollId: string, sortedIdx: number) {
	if (!isPlaced(dollId)) {
		alert("Place doll first!");
		return;
	}
	const doll = getDollInfoFromId(dollId);
	if (!doll) return;
	const sorted = getSortedUsableSkills(doll);
	const skill = sorted[sortedIdx];
	if (!skill) return;
	const hasActiveBuff =
		skill.range !== "Self" &&
		skill.range !== null &&
		skill.name !== "Absolute Mental Defense" &&
		skill.name !== "Honor Guard" &&
		skill.tags &&
		(skill.tags.includes("Healing") || skill.tags.includes("Buff")) &&
		!skill.tags.includes("Targeted") &&
		!skill.tags.includes("Tile");
	if (hasActiveBuff) {
		setTargetDollId(dollId);
		setTargetSkillId(skill.id);
		setShowTargetModal(true);
	} else {
		recordSkill(dollId, [skill.id]);
	}
}

function recordSkill(dollId: string, entry: SkillAction) {
	if (state.currentTab < 0 || state.currentTab > 7) return;
	setState(
		produce((s) => {
			const tab = s.tabData[s.currentTab]!;
			if (!tab.actions[dollId]) tab.actions[dollId] = [];
			tab.actions[dollId]!.push(entry);
			if (!tab.actionOrder.includes(dollId)) tab.actionOrder.push(dollId);
		})
	);
	saveToLocalStorage();
}

function removeAction(dollId: string, actionIdx: number) {
	console.log("removeAction", dollId, actionIdx, state.tabData[state.currentTab]!.actions[dollId]);
	setState(
		produce((s) => {
			s.tabData[s.currentTab]!.actions[dollId]?.splice(actionIdx, 1);
		})
	);
	saveToLocalStorage();
}

function reorderDolls(fromId: string, toId: string) {
	setState(
		produce((s) => {
			const tab = s.tabData[s.currentTab]!;
			let order = tab.actionOrder.length ? [...tab.actionOrder] : s.selectedDolls.map((d) => d.id);
			s.selectedDolls.forEach((d) => {
				if (!order.includes(d.id)) order.push(d.id);
			});
			const fromIdx = order.indexOf(fromId);
			const toIdx = order.indexOf(toId);
			if (fromIdx !== -1 && toIdx !== -1) {
				order.splice(fromIdx, 1);
				order.splice(toIdx, 0, fromId);
			}
			tab.actionOrder = order;
		})
	);
	saveToLocalStorage();
}

function DollRow(props: DollRowProps) {
	const dollInfo = createMemo(() => getDollInfoFromId(props.dollId));
	const placed = createMemo(() => isPlaced(props.dollId));
	const positions = createMemo(() => getPositionsForDoll(props.dollId));
	const fortification = createMemo(() => getFortificationFromId(props.dollId));
	const actions = createMemo(() => state.tabData[state.currentTab]?.actions[props.dollId] ?? []);
	const skills = createMemo(() => {
		const d = dollInfo();
		return d ? getSortedUsableSkills(d) : [];
	});

	const handleDragStart = (e: DragEvent) => {
		if (e.currentTarget instanceof HTMLElement === false) return;
		dragSrcId = props.dollId;
		e.dataTransfer!.effectAllowed = "move";
		e.currentTarget.style.opacity = "0.4";
	};

	const handleDragEnd = (e: DragEvent) => {
		if (e.currentTarget instanceof HTMLElement === false) return;
		e.currentTarget.style.opacity = "";
	};

	const handleDragOver = (e: DragEvent) => {
		if (e.currentTarget instanceof HTMLElement === false) return;
		e.preventDefault();
		e.currentTarget.classList.add("drag-over");
	};

	const handleDragLeave = (e: DragEvent) => {
		if (e.currentTarget instanceof HTMLElement === false) return;
		e.preventDefault();
		e.currentTarget.classList.remove("drag-over");
	};

	const handleDrop = (e: DragEvent) => {
		if (e.currentTarget instanceof HTMLElement === false) return;
		handleDragLeave(e);
		if (dragSrcId && dragSrcId !== props.dollId) reorderDolls(dragSrcId, props.dollId);
		dragSrcId = null;
	};

	return (
		<div
			class={`doll-row is-idle rounded-sm bg-[#E6E6E6] p-1 shadow-sm shadow-black/50 ${placed() ? "border-lime-400/40" : "border-zinc-700"}`}
			data-doll-id={props.dollId}>
			{/* Header */}
			<div class="flex flex-col gap-1.5 border-2 border-[#D7D7D7] p-1">
				<div class="drag-grip flex items-center gap-2">
					<div class="w-4">
						<Grip fill="#1C2A32" />
					</div>
					<SquareDollChip target={dollInfo()!} doll={getDollFromSummon(dollInfo()!)} icon={true} name={true} />
					<div class="min-w-0 flex-1">
						{/* Action badges */}
						<div class="mt-1 flex flex-wrap gap-1">
							<For each={actions()}>
								{(action, ai) => (
									<div class="group relative">
										<div
											onClick={() => {
												console.log(props.dollId, ai());
												removeAction(props.dollId, ai());
											}}
											class="drag-ignore cursor-pointer rounded-sm bg-[#384B53] px-1 py-0.5 text-[13px] font-bold tracking-wide text-[#EFEFEF] shadow-sm shadow-black/50 hover:bg-red-900 hover:text-red-300"
											title="Remove"
											data-action-idx={ai()}>
											{renderAction(props.dollId, action)}
										</div>
									</div>
								)}
							</For>
						</div>
					</div>
				</div>

				{/* Skill icons */}
				<div class="flex flex-wrap gap-1.5">
					<For each={skills()}>
						{(skill, idx) => <SkillIcon skill={skill} onClick={() => handleSkillClick(props.dollId, idx())} />}
					</For>
				</div>
			</div>
		</div>
	);
}

export default function ActionSidebar(props: { active: boolean }) {
	const actionOrder = createMemo(() => {
		if (state.currentTab < 0 || state.currentTab > 7) return [];
		return state.tabData[state.currentTab]?.actionOrder ?? [];
	});

	const handleDragStart = (e: MouseEvent | TouchEvent) => {
		if (e.target instanceof HTMLElement === false) return;
		if (e.target.classList.contains("drag-ignore") || e.target.closest(".drag-ignore")) return;
		if (e.target.classList.contains("drag-grip") || e.target.closest(".drag-grip")) {
			draggableItem = e.target.closest(".doll-row");
		}
		if (!draggableItem) return;

		if (e instanceof MouseEvent) {
			pointerStartX = e.clientX;
			pointerStartY = e.clientY;
		}

		if (e instanceof TouchEvent) {
			pointerStartX = e.touches[0].clientX;
			pointerStartY = e.touches[0].clientY;
		}

		setItemsGap();
		disablePageScroll();
		initDraggableItem();
		initItemsState();
		prevRect = draggableItem.getBoundingClientRect();
		document.addEventListener("mousemove", drag);
		document.addEventListener("touchmove", drag, { passive: false });
	};

	const handleDragEnd = (e: MouseEvent | TouchEvent) => {
		if (!draggableItem) return;

		applyNewItemsOrder(e);
		cleanup();
	};

	return (
		<div
			ref={listContainer}
			onMouseDown={handleDragStart}
			onTouchStart={handleDragStart}
			onMouseUp={handleDragEnd}
			onTouchEnd={handleDragEnd}
			class={`flex flex-col gap-1.5 overflow-y-auto p-1 ${props.active ? "" : "hidden"}`}>
			<For each={actionOrder()}>{(dollId, i) => <DollRow dollId={dollId} index={i()} />}</For>
		</div>
	);
}
