import { Show } from "solid-js";
import Check from "./icons/Check";
import PhaseIcon from "./icons/PhaseIcon";
import UnreleasedBadge from "./icons/UnreleasedBadge";
import Immobile from "./icons/Immobile";
import { Doll, Summon } from "../../gfl2-data/types";
import { getDollByDollOrSummon, isInertSummon, isUnreleased } from "../store/gameData";
import { rarityBorderColor } from "../store/effects";

export default function SquareDollChip(props: {
	target: Doll | Summon;
	selected?: boolean;
	draggable?: boolean;
	onClick?: () => void;
	rounded?: boolean;
	style?: string;
	size?: string;
	icon?: boolean;
	name?: boolean;
}) {
	const doll = getDollByDollOrSummon(props.target);
	const icon = "icons" in props.target ? props.target.icons.avatar : "icon" in props.target ? props.target.icon : "";
	const interactive = typeof props.onClick !== "undefined";
	return (
		<div
			onClick={props.onClick}
			draggable={props.draggable}
			style={props.style}
			class={`relative box-border flex ${props.size ?? "h-14 w-14"} flex-col overflow-hidden border-b-3 shadow-sm shadow-black/50 transition transition-discrete duration-175 ${interactive ? "cursor-pointer outline-3 hover:scale-107 hover:outline-white" : ""} ${props.selected ? "outline-[#F26C1C]" : "outline-transparent"} ${rarityBorderColor(doll.rarity)} ${props.rounded ? "rounded-sm" : ""}`}>
			<div class={`relative flex justify-center overflow-hidden bg-[#909597]`}>
				{props.selected && (
					<div class="absolute top-0.5 right-0.5 h-5 w-5 shadow-sm shadow-black/20">
						<Check />
					</div>
				)}
				<Show when={props.icon}>
					<div class="absolute top-0.5 left-0.5 h-4 w-4">
						<PhaseIcon phase={doll.phase} />
					</div>
				</Show>
				<img
					src={icon}
					loading="lazy"
					decoding="async"
					width="56"
					height="56"
					class={`${props.size ?? "h-14 w-14"} object-cover object-top`}
				/>
				<Show when={isUnreleased(props.target)}>
					<UnreleasedBadge class="bottom-0.5 left-0.5 z-20 text-[10px]" />
				</Show>
				<Show when={isInertSummon(props.target)}>
					<span
						class="gf-badge gf-badge-inert pointer-events-auto absolute right-0.5 bottom-0.5 z-20"
						title="No skills: it can't move or act, it only occupies a tile">
						<Immobile />
					</span>
				</Show>
			</div>
			<Show when={props.name}>
				<div
					class={`font-condensed absolute top-0 right-0 bottom-0 left-0 flex items-end justify-center bg-linear-to-t from-black/70 via-transparent to-transparent px-1 text-xs font-bold text-[#EFEFEF]`}>
					<div class="overflow-hidden overflow-ellipsis whitespace-nowrap">{props.target.name}</div>
				</div>
			</Show>
		</div>
	);
}
