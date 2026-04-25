import { Show } from "solid-js";
import { DollData, SummonData } from "../types";
import Check from "./icons/Check";
import PhaseIcon from "./icons/PhaseIcon";

export default function SquareDollChip(props: {
	target: DollData | SummonData;
	doll: DollData;
	selected?: boolean;
	draggable?: boolean;
	onClick?: () => void;
	onDragStart?: (e: DragEvent) => void;
	onMouseDown?: (e: MouseEvent) => void;
	onTouchStart?: (e: TouchEvent) => void;
	rounded?: boolean;
	style?: string;
	size?: string;
	icon?: boolean;
	name?: boolean;
}) {
	const interactive =
		typeof props.onClick !== "undefined" ||
		typeof props.onDragStart !== "undefined" ||
		typeof props.onMouseDown !== "undefined" ||
		typeof props.onTouchStart !== "undefined";
	return (
		<div
			onClick={props.onClick}
			onDragStart={props.onDragStart}
			onMouseDown={props.onMouseDown}
			onTouchStart={props.onTouchStart}
			draggable={props.draggable}
			style={props.style}
			class={`relative box-border flex ${props.size || "h-14 w-14"} flex-col overflow-hidden border-b-3 shadow-sm shadow-black/50 transition transition-discrete duration-175 ${interactive ? "cursor-pointer outline-3 hover:scale-107 hover:outline-white" : ""} ${props.selected ? "outline-[#F26C1C]" : "outline-transparent"} ${props.doll.rarity === "Elite" ? "border-b-[#DF9E00]" : "border-b-[#7968BA]"} ${props.rounded ? "rounded-sm" : ""}`}>
			<div class={`relative flex justify-center overflow-hidden bg-[#909597]`}>
				{props.selected && (
					<div class="absolute top-0.5 right-0.5 h-5 w-5 shadow-sm shadow-black/20">
						<Check />
					</div>
				)}
				<Show when={props.icon}>
					<div class="absolute top-0.5 left-0.5 h-4 w-4">
						<PhaseIcon phase={props.doll.phase} />
					</div>
				</Show>
				<img src={props.target.avatar} loading="lazy" class={`${props.size || "h-14 w-14"} object-cover object-top`} />
			</div>
			<Show when={props.name}>
				<div
					class={`absolute top-0 right-0 bottom-0 left-0 flex items-end justify-center bg-linear-to-t from-black/70 via-transparent to-transparent px-1 text-xs font-bold text-[#EFEFEF]`}>
					<div class="overflow-hidden overflow-ellipsis whitespace-nowrap">{props.target.name}</div>
				</div>
			</Show>
		</div>
	);
}
