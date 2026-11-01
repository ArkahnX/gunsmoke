import { Show } from "solid-js";
import { Doll, Summon } from "../../gfl2-data/types";
import { rarityBorderColor } from "../store/effects";
import { getDollByDollOrSummon, isInertSummon, isUnreleased } from "../store/gameData";
import Check from "./icons/Check";
import PhaseIcon from "./icons/PhaseIcon";
import UnreleasedBadge from "./icons/UnreleasedBadge";
import Immobile from "./icons/Immobile";
import Alert from "./icons/Alert";

export default function SmallDollChip(props: {
	target: Doll | Summon;
	selected?: boolean;
	draggable?: boolean;
	onClick?: () => void;
	onDragStart?: (e: DragEvent) => void;
	onPointerDown?: (e: PointerEvent) => void;
	style?: string;
	/** Shows the missing-equipment alert in the top right corner */
	alert?: boolean;
	/** Fades the portrait and name, for a chip that can't be used; the alert stays at full strength */
	dimmed?: boolean;
}) {
	const doll = getDollByDollOrSummon(props.target);
	const icon = "icons" in props.target ? props.target.icons.avatar : "icon" in props.target ? props.target.icon : "";
	const interactive =
		typeof props.onClick !== "undefined" || typeof props.onDragStart !== "undefined" || typeof props.onPointerDown !== "undefined";
	return (
		// the outer layer scales on hover and isn't clipped, so the alert can sit just past the chip's corner
		<div
			onClick={props.onClick}
			onDragStart={props.onDragStart}
			onPointerDown={props.onPointerDown}
			draggable={props.draggable}
			style={props.style}
			class={`group relative w-(--small-chip-width) transition transition-discrete duration-175 ${interactive ? "cursor-pointer hover:scale-107" : ""} ${props.dimmed ? "cursor-not-allowed" : ""}`}>
			<Show when={props.alert}>
				<span class="gf-badge gf-badge-missing absolute -top-1 -right-1 z-30">
					<Alert />
				</span>
			</Show>
			<div
				class={`relative box-border flex max-h-(--small-chip-height) w-(--small-chip-width) flex-col overflow-hidden rounded-sm shadow-sm shadow-black/50 transition transition-discrete duration-175 ${interactive ? "outline-3 group-hover:outline-white" : ""} ${props.selected ? "outline-[#F26C1C]" : "outline-transparent"}`}>
				<div class={`relative flex justify-center overflow-hidden bg-[#C9C8CD] ${props.dimmed ? "opacity-40" : ""}`}>
					{props.selected && (
						<div class="absolute top-0.5 right-0.5 h-5 w-5 shadow-sm shadow-black/20">
							<Check />
						</div>
					)}
					<div class="absolute top-0.5 left-0.5 h-4 w-4">
						<PhaseIcon phase={doll.phase} />
					</div>
					<img
						src={icon}
						loading="lazy"
						decoding="async"
						width="56"
						height="56"
						class="h-(--small-chip-width) w-full object-cover object-top"
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
				<div
					class={`font-condensed max-h-fit overflow-hidden border-t-3 bg-[#1C2A32] p-1 text-center text-xs font-bold overflow-ellipsis whitespace-nowrap text-[#EFEFEF] ${rarityBorderColor(doll.rarity)} ${props.dimmed ? "opacity-40" : ""}`}>
					{props.target.name}
				</div>
			</div>
		</div>
	);
}
