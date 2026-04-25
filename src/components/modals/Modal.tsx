import { children, JSX, Show } from "solid-js";

export default function Modal(props: { children: JSX.Element; title?: string; width?: string }) {
	const resolved = children(() => props.children);
	return (
		<div class={`${props.width ?? "w-225"} overflow-hidden rounded-sm border-4 border-[#CFCED2] bg-[#CFCED2] shadow-2xl`}>
			<div class="flex h-full w-full flex-col overflow-hidden border-2 border-[#B1AFB3] px-1.5 py-1.75">
				{/* Header */}
				<Show when={props.title}>
					<div class="mb-1.75 flex flex-col">
						<h2 class="h-15 flex-1 content-center bg-[#C2C0C4] text-center text-3xl font-extrabold text-[#384B53]">
							{props.title}
						</h2>
						<div class="mt-1.75 border-t-3 border-[#B5B5B6]"></div>
					</div>
				</Show>

				{resolved()}
			</div>
		</div>
	);
}
