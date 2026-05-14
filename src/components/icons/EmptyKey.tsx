import { Show } from "solid-js";

export default function EmptyKey(props: { color: "Light" | "Dark" }) {
	return (
		<svg
			width="100%"
			height="100%"
			viewBox="0 0 62 62"
			version="1.1"
			xmlns="http://www.w3.org/2000/svg"
			xmlns:xlink="http://www.w3.org/1999/xlink"
			xml:space="preserve"
			xmlns:serif="http://www.serif.com/"
			style="fill-rule:evenodd;clip-rule:evenodd;stroke-linecap:round;stroke-linejoin:round;stroke-miterlimit:1.5;">
			<g transform="matrix(1.20833,0,0,1.38095,-22.1667,-18.7143)">
				<ellipse
					cx="44"
					cy="36"
					rx="24"
					ry="21"
					style={
						props.color === "Light"
							? "fill:#6D6A78;stroke:#918E9C;stroke-width:1.54px;"
							: "fill:rgb(33,49,57);stroke:rgb(56,75,83);stroke-width:1.54px;"
					}
				/>
			</g>
			<g transform="matrix(2,0,0,1,-29,0.5)">
				<path
					d="M29,32.5L24.75,32.5L24.75,28.5L29,28.5L29,20L31,20L31,28.5L35.25,28.5L35.25,32.5L31,32.5L31,41L29,41L29,32.5Z"
					style={props.color === "Light" ? "fill:#C9C8CE;" : "fill:rgb(56,75,83);"}
				/>
			</g>
		</svg>
	);
}
