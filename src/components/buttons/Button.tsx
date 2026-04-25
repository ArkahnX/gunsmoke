import { Show } from "solid-js";
import DarkCancel from "./DarkCancel";
import DarkConfirm from "./DarkConfirm";
import DarkRefresh from "./DarkRefresh";
import LightCancel from "./LightCancel";
import LightConfirm from "./LightConfirm";
import LightRefresh from "./LightRefresh";

export default function Button(props: {
	onClick?: () => void;
	disabled?: boolean;
	color: "dark" | "light" | "red";
	design: "confirm" | "cancel" | "refresh" | "custom";
	content?: string;
}) {
	return (
		<button
			onClick={props.onClick}
			disabled={props.disabled}
			class={`${props.color === "dark" ? "bg-[#1C2A32] text-[#EFEFEF]" : props.color === "light" ? "bg-[#C9C8CE] text-[#1C2A32]" : props.color === "red" ? "bg-[#944040] text-[#EFEFEF]" : ""} ${props.design === "custom" ? "h-12 max-w-87.5 px-7.5" : "h-14 max-w-87.5 min-w-60"} relative flex cursor-pointer flex-row items-center overflow-hidden rounded-sm text-xl font-bold whitespace-nowrap shadow-sm shadow-black/50 outline-3 outline-transparent transition transition-discrete duration-250 hover:outline-white hover:duration-0`}>
			<Show when={props.design !== "custom"}>
				<div class="flex h-full shrink">
					<Show when={props.design === "cancel" && props.color === "dark"}>
						<DarkCancel />
					</Show>
					<Show when={props.design === "confirm" && props.color === "dark"}>
						<DarkConfirm />
					</Show>
					<Show when={props.design === "refresh" && props.color === "dark"}>
						<DarkRefresh />
					</Show>
					<Show when={props.design === "cancel" && props.color === "light"}>
						<LightCancel />
					</Show>
					<Show when={props.design === "confirm" && props.color === "light"}>
						<LightConfirm />
					</Show>
					<Show when={props.design === "refresh" && props.color === "light"}>
						<LightRefresh />
					</Show>
				</div>
			</Show>
			<span class={`grow ${props.design === "custom" ? "pr-0" : "pr-4"}`}>
				<Show when={props.design === "cancel"}>{props.content ?? "Cancel"}</Show>
				<Show when={props.design === "confirm"}>{props.content ?? "Confirm"}</Show>
				<Show when={props.design === "refresh"}>{props.content ?? "Reset"}</Show>
				<Show when={props.design === "custom"}>{props.content}</Show>
			</span>
		</button>
	);
}
