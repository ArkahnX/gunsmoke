export default function Hydro(props: { fill?: string }) {
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
			<g id="standalone" transform="matrix(1.72817,0,0,1.72817,-29.223,-29.1504)">
				<g id="Hydro">
					<g id="standalone1" serif:id="standalone">
						<g transform="matrix(1,0,0,1,2,-1.5)">
							<path
								d="M28.498,38.795C27.628,40.686 25.716,42 23.5,42C20.464,42 18,39.536 18,36.5C18,35.615 18.209,34.779 18.581,34.038C28.304,13.475 48.678,15.236 59.198,36.5C48.334,25.273 37.769,23.076 28.498,38.795Z"
								style={`fill:${props.fill ?? "rgb(43,168,216)"};`}
							/>
						</g>
						<g transform="matrix(-1,0,0,-1,78.1114,81.5649)">
							<path
								d="M28.498,38.795C27.628,40.686 25.716,42 23.5,42C20.464,42 18,39.536 18,36.5C18,35.615 18.209,34.779 18.581,34.038C28.304,13.475 48.678,15.236 59.198,36.5C48.334,25.273 37.769,23.076 28.498,38.795Z"
								style={`fill:${props.fill ?? "rgb(43,168,216)"};`}
							/>
						</g>
					</g>
				</g>
			</g>
		</svg>
	);
}
