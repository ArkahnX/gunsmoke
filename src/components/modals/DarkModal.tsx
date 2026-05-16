import { children, JSX, Show } from "solid-js";

export default function DarkModal(props: { children: JSX.Element; width?: string; hide?: boolean }) {
	const resolved = children(() => props.children);
	return (
		<div
			class={`${props.width ?? "w-225"} ${props.hide ? "hidden" : ""} flex flex-col overflow-hidden rounded-sm border-t-4 border-[#3E5356] bg-[#2C373B] shadow-2xl`}>
			{resolved()}
		</div>
	);
}
