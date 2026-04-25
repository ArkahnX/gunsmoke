import { DollData, SummonData } from "../types";
import Check from "./icons/Check";
import PhaseIcon from "./icons/PhaseIcon";

export default function SmallDollChip(props: {
	target: DollData | SummonData;
	doll: DollData;
	selected?: boolean;
	draggable?: boolean;
	onClick?: () => void;
	onDragStart?: (e: DragEvent) => void;
	onMouseDown?: (e: MouseEvent) => void;
	onTouchStart?: (e: TouchEvent) => void;
	style?: string;
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
			class={`relative box-border flex max-h-17 w-14 flex-col overflow-hidden rounded-sm shadow-sm shadow-black/50 transition transition-discrete duration-175 ${interactive ? "cursor-pointer outline-3 hover:scale-107 hover:outline-white" : ""} ${props.selected ? "outline-[#F26C1C]" : "outline-transparent"}`}>
			<div class={`relative flex justify-center overflow-hidden bg-[#C9C8CD]`}>
				{props.selected && (
					<div class="absolute top-0.5 right-0.5 h-5 w-5 shadow-sm shadow-black/20">
						<Check />
					</div>
				)}
				<div class="absolute top-0.5 left-0.5 h-4 w-4">
					<PhaseIcon phase={props.doll.phase} />
				</div>
				<img src={props.target.avatar} loading="lazy" class="h-14 w-14 object-cover object-top" />
			</div>
			<div
				class={`max-h-fit overflow-hidden border-t-3 bg-[#1C2A32] p-1 text-center text-xs font-bold overflow-ellipsis whitespace-nowrap text-[#EFEFEF] ${props.doll.rarity === "Elite" ? "border-t-[#DF9E00]" : "border-t-[#7968BA]"}`}>
				{props.target.name}
			</div>
		</div>
	);
}
