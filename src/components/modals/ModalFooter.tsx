import { children, JSX } from "solid-js";

export default function ModalFooter(props: { children: JSX.Element; styles?: string }) {
	const resolved = children(() => props.children);
	return (
		<div class="flex flex-col">
			<div class="my-1.75 border-t-3 border-[#B5B5B6]"></div>
			<div class={`flex px-4 py-4 pt-2.25 ${props.styles}`}>{resolved()}</div>
		</div>
	);
}
