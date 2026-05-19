import { JSX } from "solid-js/jsx-runtime";

const tsxBuffs: Record<string, JSX.Element> = {
	b6: (
		<span>
			If an enemy is afflicted by Corrosion debuff(s), increases critical damage against them by{" "}
			<span style="color:#f26c1c">25%</span>.
		</span>
	),
	b12: (
		<span>
			Damage dealt is increased by <span style="color:#f26c1c">20%</span> when distance to the enemy target is less than or equal to{" "}
			<span style="color:#f26c1c">6 tiles</span>.
		</span>
	),
	b13: (
		<span>
			For every <span style="color:#f26c1c">2000</span> points of <span style="color:#f26c1c">healing</span> or{" "}
			<span style="color:#f26c1c">shield</span> applied to allies by Support Dolls, gain <span style="color:#f26c1c">1 stack</span> of{" "}
			<span style="color:#3487e0">Complementarity Plan</span>.
		</span>
	),
	b14: (
		<span>
			If this unit's has <span style="color:#f26c1c">2 or more</span> points of Confectance Index at the start of the round, damage
			dealt is increased by <span style="color:#f26c1c">25%</span> until the end of the round.
		</span>
	),
	b16: (
		<span>
			Corrosion damage is increased by <span style="color:#f26c1c">20%</span>.
		</span>
	),
	b28: (
		<span>
			When shielded, attacks ignore <span style="color:#f26c1c">20%</span> of the target's defense and critical damage is increased by{" "}
			<span style="color:#f26c1c">10%</span>.
		</span>
	),
	b45: (
		<span>
			Light Ammo ignores <span style="color:#f26c1c">50%</span> of target's defense.
		</span>
	),
	b49: (
		<span>
			For every <span style="color:#f26c1c">1 allied unit</span> within <span style="color:#f26c1c">5 tiles</span>, damage dealt is
			increased by <span style="color:#f26c1c">6%</span>.
		</span>
	),
	b51: (
		<span>
			Sentinel-class Dolls' critical damage is increased by <span style="color:#f26c1c">25%</span>.
		</span>
	),
	b55: (
		<span>
			Increases Corrosion and Freeze damage and their critical rate by <span style="color:#f26c1c">30%</span>.
		</span>
	),
	b67: (
		<span>
			<span style="color:#f26c1c">Each time</span> a Bulwark-class Doll takes damage, gain <span style="color:#f26c1c">1 stack</span>{" "}
			of <span style="color:#3487e0">Undaunted Spirit</span>.
		</span>
	),
};

export function Buffs(props: { id: string }) {
	if (props.id in tsxBuffs) {
		return tsxBuffs[props.id];
	}
	return null;
}
