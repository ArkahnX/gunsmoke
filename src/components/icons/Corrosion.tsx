export default function Corrosion(props: { fill?: string }) {
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
			<g id="standalone" transform="matrix(1.74713,0,0,1.74713,-30.3218,-30.7586)">
				<g id="Corrosion">
					<g id="standalone1" serif:id="standalone">
						<g transform="matrix(1.11111,0,0,1.25,-5.38889,-15.5)">
							<ellipse cx="39.5" cy="58" rx="4.5" ry="4" style={`fill:${props.fill ?? "rgb(134,121,232)"};`} />
						</g>
						<g transform="matrix(1.06667,0,0,1.23077,-4.13333,-11.2308)">
							<ellipse cx="54.5" cy="46.5" rx="7.5" ry="6.5" style={`fill:${props.fill ?? "rgb(134,121,232)"};`} />
						</g>
						<g transform="matrix(1.18182,0,0,1,-10.5455,1)">
							<ellipse cx="52.5" cy="24.5" rx="5.5" ry="6.5" style={`fill:${props.fill ?? "rgb(134,121,232)"};`} />
						</g>
						<g transform="matrix(0.884615,0,0,1.21053,4.34615,-7.68421)">
							<ellipse cx="29" cy="36.5" rx="13" ry="9.5" style={`fill:${props.fill ?? "rgb(134,121,232)"};`} />
						</g>
					</g>
				</g>
			</g>
		</svg>
	);
}
