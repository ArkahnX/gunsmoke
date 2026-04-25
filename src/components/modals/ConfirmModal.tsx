import FullScreen from "./FullScreen";
import Modal from "./Modal";
import ModalHeader from "./ModalHeader";
import ModalFooter from "./ModalFooter";
import Button from "../buttons/Button";
import { Accessor, Setter, Show } from "solid-js";
import { Portal } from "solid-js/web";

export default function ConfirmModal(props: {
	onClick: () => void;
	mount: HTMLElement;
	isActive: Accessor<boolean>;
	setActive: Setter<boolean>;
	content: string;
	title?: string;
}) {
	function getTextWidth(text: string) {
		var canvas = document.createElement("canvas");
		var context = canvas.getContext("2d")!;
		context.font = "bold 16px Roboto, sans-serif";
		var metrics = context.measureText(text);
		return `w-[${Math.floor(metrics.width)}px]`;
	}

	return (
		<Portal mount={props.mount}>
			<Show when={props.isActive()} fallback={null}>
				<FullScreen>
					<Modal width={getTextWidth(props.content)}>
						<ModalHeader title={props.title ?? "Confirm"} />
						<div class="text-md justify-center text-center font-bold text-[#1C2A32]">{props.content}</div>
						<ModalFooter styles="gap-4">
							<Button onClick={() => props.setActive(false)} color="dark" design="cancel" />
							<Button
								onClick={() => {
									props.setActive(false);
									props.onClick();
								}}
								color="dark"
								design="confirm"
							/>
						</ModalFooter>
					</Modal>
				</FullScreen>
			</Show>
		</Portal>
	);
}
