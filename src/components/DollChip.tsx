import { Phase, PhaseLabels } from "../../gfl2-data/enums";
import { Show } from "solid-js";
import { Doll, Summon } from "../../gfl2-data/types";
import { interactiveStyles, rarityBorderColor } from "../store/effects";
import { getDollByDollOrSummon, isInertSummon, isUnreleased } from "../store/gameData";
import Check from "./icons/Check";
import PhaseIcon from "./icons/PhaseIcon";
import UnreleasedBadge from "./icons/UnreleasedBadge";
import Immobile from "./icons/Immobile";

export default function DollChip(props: {
	target: Doll | Summon;
	selected?: boolean;
	pinned?: boolean;
	onClick?: () => void;
	style?: string;
}) {
	const icon = "icons" in props.target ? props.target.icons.avatar : "icon" in props.target ? props.target.icon : "";
	const doll = getDollByDollOrSummon(props.target);
	const phaseClass =
		doll.phase === Phase.Resonance ? [Phase.Burn, Phase.Corrosion, Phase.Electric, Phase.Freeze, Phase.Hydro] : [doll.phase];
	const phase = phaseClass.map((p) => PhaseLabels[p]).join(" ");
	return (
		<div
			onClick={props.onClick}
			style={props.style}
			class={`doll ${phase} All show ${props.pinned ? "pinned" : ""} h-40.5 w-31.5 flex-col overflow-hidden rounded-sm shadow-sm shadow-black/50 ${interactiveStyles(props.selected)}`}>
			<div class={`relative flex justify-center border-b-4 bg-[#C9C8CD] ${rarityBorderColor(doll.rarity)}`}>
				{props.selected && (
					<div class="absolute top-1 right-1 h-7 w-7 shadow-sm shadow-black/20">
						<Check />
					</div>
				)}
				<div class="absolute top-1 left-1 h-6 w-6">
					<PhaseIcon phase={doll.phase} />
				</div>
				<img src={icon} loading="lazy" decoding="async" width="128" height="128" class="h-auto w-32 object-cover" />
				<Show when={isUnreleased(props.target)}>
					<UnreleasedBadge />
				</Show>
				<Show when={isInertSummon(props.target)}>
					<span
						class="gf-badge gf-badge-inert pointer-events-auto absolute right-0.5 bottom-0.5 z-20"
						title="No skills: it can't move or act, it only occupies a tile">
						<Immobile />
					</span>
				</Show>
			</div>
			<div class="font-condensed bg-[#1C2A32] p-1 text-center font-bold text-[#EFEFEF]">{props.target.name}</div>
		</div>
	);
}
