import { JSX } from "solid-js/jsx-runtime";

const tsxBuffs: Record<string, JSX.Element> = {
	b1: (
		<span>
			When this unit possesses a <span style="color:#8679e8">Corrosion</span> buff, damage dealt is increased by <span style="color:#f26c1c">20%</span>.
		</span>
	),
	b4: (
		<span>
			When this unit has a <span style="color:#e67129">Burn</span> buff, damage dealt is increased by <span style="color:#f26c1c">20%</span>.
		</span>
	),
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
	b18: (
		<span>
			Increases <span style="color:#d4ae08">Electric</span> and <span style="color:#8679e8">Corrosion</span> damage and their critical rate by <span style="color:#f26c1c">30%</span>.
		</span>
	),
	b23: (
		<span>
			When this unit has an <span style="color:#d4ae08">Electric</span> buff, damage dealt is increased by <span style="color:#f26c1c">20%</span>.
		</span>
	),
	b27: (
		<span>
			At the start of the turn, gain <span style="color:#f26c1c">10 stacks</span> of <span style="color:#3487e0">Firepower Overmatch</span>.\nFirepower Overmatch:\nDamage dealt is increased by <span style="color:#f26c1c">8%</span> and critical damage is increased by <span style="color:#f26c1c">5%</span> per stack, to a maximum of <span style="color:#f26c1c">50 stacks</span>. For <span style="color:#f26c1c">each point</span> of mobility spent, remove <span style="color:#f26c1c">1 stack</span> of this effect.
		</span>
	),
	b28: (
		<span>
			When shielded, attacks ignore <span style="color:#f26c1c">20%</span> of the target's defense and critical damage is increased by{" "}
			<span style="color:#f26c1c">10%</span>.
		</span>
	),
	b29: (
		<span>
			When this unit has a <span style="color:#42cce0">Freeze</span> buff, damage dealt is increased by <span style="color:#f26c1c">20%</span>.
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
	b61: (
		<span>
			For every <span style="color:#f26c1c">5 tiles</span> moved, damage dealt is permanently increased by <span style="color:#f26c1c">5%</span>. Maximum of <span style="color:#f26c1c">10 stacks</span>.
		</span>
	),
	b65: (
		<span>
			For every <span style="color:#f26c1c">1 instance</span> of fixed damage taken by an enemy, all damage dealt by allied units is permanently increased by <span style="color:#f26c1c">2%</span>. Maximum of 15 stacks.
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
