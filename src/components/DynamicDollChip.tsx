import { Show } from "solid-js";
import { Doll, Summon } from "../../gfl2-data/types";
import { rarityBorderColor } from "../store/effects";
import { getDollByDollOrSummon, isUnreleased } from "../store/gameData";
import Check from "./icons/Check";
import PhaseIcon from "./icons/PhaseIcon";
import UnreleasedBadge from "./icons/UnreleasedBadge";

export default function DynamicDollChip(props: { target: Doll | Summon; selected?: boolean; onClick?: () => void; style?: string }) {
	const doll = getDollByDollOrSummon(props.target);
	const icon = "icons" in props.target ? props.target.icons.avatar : "icon" in props.target ? props.target.icon : "";
	return (
		<div onClick={props.onClick} style={props.style} class={`h-30 w-23 flex-col overflow-hidden rounded-sm shadow-sm shadow-black/50`}>
			<div class={`relative flex justify-center border-b-4 bg-[#C9C8CD] ${rarityBorderColor(doll.rarity)}`}>
				{props.selected && (
					<div class="absolute top-1 right-1 h-6 w-6 shadow-sm shadow-black/20">
						<Check />
					</div>
				)}
				<div class="absolute top-1 left-1 h-5 w-5">
					<PhaseIcon phase={doll.phase} />
				</div>
				<img src={icon} loading="lazy" decoding="async" width="90" height="90" class="h-auto w-22.5 object-cover" />
				<Show when={isUnreleased(props.target)}>
					<UnreleasedBadge />
				</Show>
			</div>
			<div class="font-condensed bg-[#1C2A32] p-1 text-center text-[14px] font-bold text-[#EFEFEF]">{props.target.name}</div>
		</div>
	);
}
