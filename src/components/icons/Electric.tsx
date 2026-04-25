export default function Electric(props: { fill?: string }) {
	return (
		<svg
			width="100%"
			height="100%"
			viewBox="0 0 80 80"
			version="1.1"
			xmlns="http://www.w3.org/2000/svg"
			xmlns:xlink="http://www.w3.org/1999/xlink"
			xml:space="preserve"
			xmlns:serif="http://www.serif.com/"
			style="fill-rule:evenodd;clip-rule:evenodd;stroke-linejoin:round;stroke-miterlimit:2;">
			<g id="standalone" transform="matrix(1.63441,0,0,1.63441,-27.828,-26.6022)">
				<g id="Electric">
					<path
						id="standalone1"
						serif:id="standalone"
						d="M50,17.5L33,17.5L25,46L42,42L34,64L58,33L40,36L50,17.5Z"
						style={`fill:${props.fill ?? "rgb(235,191,33)"};`}
					/>
				</g>
			</g>
		</svg>
	);
}
