import { createMemo, createResource, createSignal, For } from "solid-js";
import {
	compress,
	state,
	getDollNamesAndFortifications,
	setShowSkillDisplayModal,
	updateSkillDisplay,
	getDollFromId,
	renderAction,
	notations,
	skillOrder,
} from "../../store";
import { Select } from "@thisbeyond/solid-select";
import { SAVE_VERSION } from "../../types/constants";
import Button from "../buttons/Button";
import ModalFooter from "./ModalFooter";
import ModalHeader from "./ModalHeader";
import SkillIcon from "../icons/SkillIcon";

export default function SkillDisplayModal() {
	const exportOptions = ["code only", "code for discord", "shareable url"];
	const [exportType, setExportType] = createSignal(exportOptions[2]);
	const [copied, setCopied] = createSignal(false);

	const getExportString = async () => {
		const exportObj = { version: SAVE_VERSION, ...state };
		return await compress(JSON.stringify(exportObj));
	};

	const [exportString] = createResource(getExportString);

	const output = createMemo(() => {
		const dolls = getDollNamesAndFortifications();
		if (exportType() === exportOptions[0]) return exportString();
		if (exportType() === exportOptions[1]) return dolls.join(", ") + "\n" + "```" + exportString() + "```";
		if (exportType() === exportOptions[2])
			return dolls.join(", ") + "\n" + `${window.location.origin + window.location.pathname}?state=` + exportString();
		return exportString();
	});

	const handleCopy = async () => {
		await navigator.clipboard.writeText(output() ?? "");
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	};

	// hardcoded Yoohee for her A and B skills
	const dollInfo = getDollFromId("d54");
	const basicSkill = dollInfo?.skills?.filter((s) => s.type === "Basic Attack") ?? [];
	const passiveSkill = dollInfo?.skills?.filter((s) => s.type === "Passive") ?? [];
	const numberedSkills = dollInfo?.skills?.filter((s) => s.type.match(/Skill [0-9]/)) ?? [];
	const letteredSkills = dollInfo?.skills?.filter((s) => s.type.match(/Skill [A-Z]/)) ?? [];
	const skills = [...basicSkill, ...numberedSkills, ...passiveSkill, ...letteredSkills];

	const statedActionTypes = createMemo(() => Array.from(state.actionType as string));

	const notationFromType = (type: string) => {
		return parseInt(statedActionTypes()[skillOrder.indexOf(type)]);
	};

	return (
		<>
			<ModalHeader title="Skill Display" />
			<div class="flex flex-col gap-2 self-center">
				<For each={Object.entries(notations)}>
					{([notation, values]) => (
						<div class="mx-3 grid grid-cols-2 items-center justify-center gap-1 text-[#384B53]">
							<span>{`${notation} style:`}</span>
							<Select
								class="custom"
								options={values}
								onChange={(value) => updateSkillDisplay(notation, value)}
								initialValue={values[notationFromType(notation)]}
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
