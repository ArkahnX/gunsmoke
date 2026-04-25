export default function Grip(props: { fill?: string }) {
	return (
		<svg
			width="100%"
			height="100%"
			viewBox="0 0 40 40"
			version="1.1"
			xmlns="http://www.w3.org/2000/svg"
			xmlns:xlink="http://www.w3.org/1999/xlink"
			xml:space="preserve"
			xmlns:serif="http://www.serif.com/"
			style="fill-rule:evenodd;clip-rule:evenodd;stroke-linejoin:round;stroke-miterlimit:2;">
			<g transform="matrix(1,0,0,1,-17,-34)">
				<g transform="matrix(1.14286,0,0,1,-3.85714,0)">
					<ellipse cx="30.5" cy="42" rx="3.5" ry="4" style={`fill:${props.fill ?? "rgb(235,235,235)"};`} />
				</g>
				<g transform="matrix(1.14286,0,0,1,-3.85714,12)">
					<ellipse cx="30.5" cy="42" rx="3.5" ry="4" style={`fill:${props.fill ?? "rgb(235,235,235)"};`} />
				</g>
				<g transform="matrix(1.14286,0,0,1,-3.85714,24)">
					<ellipse cx="30.5" cy="42" rx="3.5" ry="4" style={`fill:${props.fill ?? "rgb(235,235,235)"};`} />
				</g>
				<g transform="matrix(1.14286,0,0,1,8.14286,24)">
					<ellipse cx="30.5" cy="42" rx="3.5" ry="4" style={`fill:${props.fill ?? "rgb(235,235,235)"};`} />
				</g>
				<g transform="matrix(1.14286,0,0,1,8.14286,0)">
					<ellipse cx="30.5" cy="42" rx="3.5" ry="4" style={`fill:${props.fill ?? "rgb(235,235,235)"};`} />
				</g>
				<g transform="matrix(1.14286,0,0,1,8.14286,12)">
					<ellipse cx="30.5" cy="42" rx="3.5" ry="4" style={`fill:${props.fill ?? "rgb(235,235,235)"};`} />
				</g>
			</g>
		</svg>
	);
}
