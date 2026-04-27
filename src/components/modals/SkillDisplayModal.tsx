import { For } from "solid-js";
import {
	setShowSkillDisplayModal,
	getDollFromId,
	renderAction,
	notations,
	setOverrideSkillNotations,
	setSkillDisplay,
	getSkillDisplay,
	saveToLocalStorage,
	overrideSkillNotations,
} from "../../store";
import { Select } from "@thisbeyond/solid-select";
import Button from "../buttons/Button";
import ModalFooter from "./ModalFooter";
import ModalHeader from "./ModalHeader";
import SkillIcon from "../icons/SkillIcon";

export default function SkillDisplayModal() {
	// hardcoded Yoohee for her A and B skills
	const dollInfo = getDollFromId("d54");
	const basicSkill = dollInfo?.skills?.filter((s) => s.type === "Basic Attack") ?? [];
	const passiveSkill = dollInfo?.skills?.filter((s) => s.type === "Passive") ?? [];
	const numberedSkills = dollInfo?.skills?.filter((s) => s.type.match(/Skill [0-9]/)) ?? [];
	const letteredSkills = dollInfo?.skills?.filter((s) => s.type.match(/Skill [A-Z]/)) ?? [];
	const skills = [...basicSkill, ...numberedSkills, ...passiveSkill, ...letteredSkills];

	return (
		<>
			<ModalHeader title="Skill Display" />
			<div class="flex flex-col gap-2 self-center">
				<div class="mx-3 grid grid-cols-2 items-center justify-center gap-1 text-[#384B53]">
					<span>{`Override imported notations:`}</span>
					<Select
						class="custom"
						options={["true", "false"]}
						onChange={(value) => {
							setOverrideSkillNotations(value === "true" ? true : false);
							saveToLocalStorage();
						}}
						initialValue={String(overrideSkillNotations())}
					/>
				</div>
				<For each={Object.entries(notations)}>
					{([notation, values]) => (
						<div class="mx-3 grid grid-cols-2 items-center justify-center gap-1 text-[#384B53]">
							<span>{`${notation} style:`}</span>
							<Select
								class="custom"
								options={values}
								onChange={(value) => setSkillDisplay(notation, value)}
								initialValue={getSkillDisplay(notation)}
							/>
						</div>
					)}
				</For>
				<div class="text-md mx-3 flex h-10 items-center justify-center self-stretch bg-[#384B53] font-bold tracking-wide text-[#ECECEC]">
					Preview
				</div>
				<div class="flex flex-wrap justify-center gap-1.5">
					<For each={skills}>
						{(skill, idx) => (
							<div class="flex flex-col gap-1">
								<SkillIcon skill={skill} />
								<div
									class="drag-ignore cursor-pointer rounded-sm bg-[#384B53] px-1 py-0.5 text-center text-[13px] font-bold tracking-wide text-[#EFEFEF] shadow-sm shadow-black/50"
									data-skill-id={skill.id}>
									{renderAction("d54", [skill.id])}
								</div>
							</div>
						)}
					</For>
				</div>
			</div>
			<ModalFooter styles="justify-center">
				<Button onClick={() => setShowSkillDisplayModal(false)} color="dark" design="cancel" content="Close" />
			</ModalFooter>
		</>
	);
}
