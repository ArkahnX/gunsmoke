import { For } from "solid-js";
import Button from "../buttons/Button";
import Dropdown from "../Dropdown";
import ModalFooter from "./ModalFooter";
import ModalHeader from "./ModalHeader";
import SkillIcon from "../icons/SkillIcon";
import { getDollById, getSkillDisplay, setSkillDisplay } from "../../store/gameData";
import { setShowSkillDisplayModal } from "../../store/uiState";
import { updateVisibleSkillOption } from "../../store/persistence";
import { renderActionBySkill } from "../../store/effects";
import { SkillType, SkillTypeLabels } from "../../../gfl2-data/enums";
import { endTurnSkill, getNotations, localState, skillOrder } from "../../store/appState";

export default function SkillDisplayModal() {
	// hardcoded Yoohee for her A and B skills

	const dollInfo = getDollById("d10");
	const basicSkill = dollInfo?.skills?.filter((s) => s.type === SkillType.BasicAttack) ?? [];
	const passiveSkill = dollInfo?.skills?.filter((s) => s.type === SkillType.Passive) ?? [];
	const numberedSkills =
		dollInfo?.skills?.filter((s) => s.type === SkillType.Skill1 || s.type === SkillType.Skill2 || s.type === SkillType.Ultimate) ?? [];
	const letteredSkills =
		dollInfo?.skills?.filter((s) => s.type === SkillType.SkillA || s.type === SkillType.SkillB || s.type === SkillType.SkillC) ?? [];
	const moveSkills = dollInfo?.skills?.filter((s) => s.type === SkillType.Move) ?? [];
	const skills = [...moveSkills, ...basicSkill, ...numberedSkills, ...passiveSkill, ...letteredSkills, endTurnSkill];
	// listed in display order; skill types without notation styles have nothing to choose
	const filteredNotations = skillOrder
		.map((type) => [type, getNotations(type)] as [SkillType, string[]])
		.filter(([_type, values]) => values.length > 0);

	return (
		<>
			<ModalHeader title="Options" />
			<div class="flex flex-col gap-2 self-center">
				<div class="mx-3 grid grid-cols-2 items-center justify-center gap-1 text-[#384B53]">
					<span>{`Show all skills and summons:`}</span>
					<Dropdown
						options={["always", "only with keys"]}
						value={localState.alwaysDisplaySkills ? "always" : "only with keys"}
						onChange={(value) => {
							updateVisibleSkillOption(value === "always");
						}}
					/>
				</div>
				<For each={filteredNotations}>
					{([notation, values]) => (
						<div class="mx-3 grid grid-cols-2 items-center justify-center gap-1 text-[#384B53]">
							<span>{`${SkillTypeLabels[notation]} style:`}</span>
							<Dropdown
								options={values}
								value={getSkillDisplay(notation)}
								onChange={(value) => {
									setSkillDisplay(notation, value);
								}}
							/>
						</div>
					)}
				</For>
				<div class="text-md mx-3 flex h-10 items-center justify-center self-stretch bg-[#384B53] font-bold tracking-wide text-[#ECECEC]">
					Preview
				</div>
				<div class="flex flex-wrap justify-center gap-1.5">
					<For each={skills}>
						{(skill, _idx) => (
							<div class="flex flex-col gap-1">
								<SkillIcon skill={skill} />
								<div
									class="drag-ignore cursor-pointer rounded-sm bg-[#384B53] px-1 py-0.5 text-center text-[13px] font-bold tracking-wide text-[#EFEFEF] shadow-sm shadow-black/50"
									data-skill-id={skill.id}>
									{renderActionBySkill(skill)}
								</div>
							</div>
						)}
					</For>
				</div>
			</div>
			<ModalFooter styles="justify-center">
				<Button
					onClick={() => {
						setShowSkillDisplayModal(false);
					}}
					color="dark"
					design="cancel"
					content="Close"
				/>
			</ModalFooter>
		</>
	);
}
