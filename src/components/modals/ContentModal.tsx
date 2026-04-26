import FullScreen from "./FullScreen";
import Modal from "./Modal";
import ModalHeader from "./ModalHeader";
import ModalFooter from "./ModalFooter";
import Button from "../buttons/Button";
import { Accessor, children, JSX, Setter, Show } from "solid-js";
import { Portal } from "solid-js/web";

export default function ContentModal(props: {
	mount: HTMLElement;
	isActive: Accessor<boolean>;
	setActive: Setter<boolean>;
	children: JSX.Element;
	width: string;
	title?: string;
}) {
	const resolved = children(() => props.children);
	return (
		<Portal mount={props.mount}>
			<Show when={props.isActive()} fallback={null}>
				<FullScreen>
					<Modal width={props.width}>
						<ModalHeader title={props.title ?? "Confirm"} />
						{resolved()}
						<ModalFooter styles="gap-4 justify-center">
							<Button onClick={() => props.setActive(false)} color="dark" design="cancel" />
						</ModalFooter>
					</Modal>
				</FullScreen>
			</Show>
		</Portal>
	);
}
