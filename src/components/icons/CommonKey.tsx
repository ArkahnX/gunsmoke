import { Show } from "solid-js";

export default function CommonKey(props: { rarity: string }) {
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
			<g transform="matrix(1,0,0,1,-33,-5.5)">
				<Show when={props.rarity !== "Elite" && props.rarity !== "Standard"}>
					<g transform="matrix(1,0,0,0.944444,-0.5,-0.555556)">
						<path d="M43.5,8L50.861,12.5L50.861,21.5L43.5,26L36.139,21.5L36.139,12.5L43.5,8Z" style="fill:rgb(63,78,82);" />
					</g>
				</Show>
				<Show when={props.rarity === "Elite" || props.rarity === "Standard"}>
					<g transform="matrix(0.470588,0,0,0.444444,22.5294,7.94444)">
						<path d="M43.5,8L50.861,12.5L50.861,21.5L43.5,26L36.139,21.5L36.139,12.5L43.5,8Z" style="fill:rgb(152,154,159);" />
					</g>
				</Show>
				<g transform="matrix(1.17647,0,0,1.11111,-8.17647,-3.38889)">
					<path
						d="M43.5,8L50.861,12.5L50.861,21.5L43.5,26L36.139,21.5L36.139,12.5L43.5,8ZM43.5,10.25L37.979,13.625L37.979,20.375L43.5,23.75L49.021,20.375L49.021,13.625L43.5,10.25Z"
						style={`fill:#${color}`}
					/>
				</g>
			</g>
		</svg>
	);
}
