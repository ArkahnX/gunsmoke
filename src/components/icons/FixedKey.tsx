import { Show } from "solid-js";

export default function FixedKey(props: { rarity: string }) {
	const color = props.rarity === "Elite" ? "A87D36" : props.rarity === "Standard" ? "5F5A90" : "5B6468";
	return (
		<svg
			width="100%"
			height="100%"
			viewBox="0 0 20 20"
			version="1.1"
			xmlns="http://www.w3.org/2000/svg"
			xmlns:xlink="http://www.w3.org/1999/xlink"
			xml:space="preserve"
			xmlns:serif="http://www.serif.com/"
			style="fill-rule:evenodd;clip-rule:evenodd;stroke-linejoin:round;stroke-miterlimit:2;">
			<g transform="matrix(1,0,0,1,-4,-5.5)">
				<Show when={props.rarity !== "Elite" && props.rarity !== "Standard"}>
					<g transform="matrix(1,0,0,0.894737,-0.5,1.63158)">
						<path d="M14.5,6L23,15.5L14.5,25L6,15.5L14.5,6Z" style="fill:rgb(63,78,82);" />
					</g>
				</Show>
				<Show when={props.rarity === "Elite" || props.rarity === "Standard"}>
					<g transform="matrix(0.470588,0,0,0.421053,7.17647,8.97368)">
						<path d="M14.5,6L23,15.5L14.5,25L6,15.5L14.5,6Z" style="fill:rgb(152,154,159);" />
					</g>
				</Show>
				<g transform="matrix(1.17647,0,0,1.05263,-3.05882,-0.815789)">
					<path
						d="M14.5,6L23,15.5L14.5,25L6,15.5L14.5,6ZM14.5,8.375L8.125,15.5L14.5,22.625L20.875,15.5L14.5,8.375Z"
						style={`fill:#${color}`}
					/>
				</g>
			</g>
		</svg>
	);
}
