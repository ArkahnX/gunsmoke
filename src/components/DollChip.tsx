import { interactiveStyles } from "../store";
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
	const phase = props.doll.phase === "Omni" ? "Burn Electric Freeze Corrosion Hydro" : props.doll.phase;
	return (
		<div
			onClick={props.onClick}
			style={props.style}
			class={`doll ${phase} All show h-40.5 w-31.5 flex-col overflow-hidden rounded-sm shadow-sm shadow-black/50 ${interactiveStyles(props.selected)}`}>
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
