import { Skill } from "../../types";

export default function SkillIcon(props: {
	skill: Skill;
	onClick?: () => void;
}) {
	return (
		<div class="skill-icon shrink-0 cursor-pointer" onClick={props.onClick}>
			<img
				src={props.skill.localImagePath}
				class="h-10 w-10 rounded-sm bg-black/70 border-2 border-[#717376] object-cover outline-2 outline-transparent transition transition-discrete duration-175 hover:scale-107 hover:outline-white"
				title={props.skill.name}
			/>
		</div>
	);
}
