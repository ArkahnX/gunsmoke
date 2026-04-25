import { DollData, SummonData } from "../types";
import Check from "./icons/Check";
import PhaseIcon from "./icons/PhaseIcon";

export default function DollChip(props: {
	target: DollData | SummonData;
	doll: DollData;
	selected?: boolean;
	onClick?: () => void;
	style?: string;
}) {
	return (
		<div
			onClick={props.onClick}
			style={props.style}
			class={`doll ${props.doll.phase} All show h-40.5 w-31.5 cursor-pointer flex-col overflow-hidden rounded-sm shadow-sm shadow-black/50 outline-4 transition transition-discrete duration-175 hover:scale-107 hover:outline-white ${props.selected ? "outline-[#F26C1C]" : "outline-transparent"}`}>
			<div
				class={`relative flex justify-center border-b-4 bg-[#C9C8CD] ${props.doll.rarity === "Elite" ? "border-b-[#DF9E00]" : "border-b-[#7968BA]"}`}>
				{props.selected && (
					<div class="absolute top-1 right-1 h-7 w-7 shadow-sm shadow-black/20">
						<Check />
					</div>
				)}
				<div class="absolute top-1 left-1 h-6 w-6">
					<PhaseIcon phase={props.doll.phase} />
				</div>
				<img src={props.target.avatar} loading="lazy" class="h-auto w-32 object-cover" />
			</div>
			<div class="bg-[#1C2A32] p-1 text-center font-bold text-[#EFEFEF]">{props.target.name}</div>
		</div>
	);
}
