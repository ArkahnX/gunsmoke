/** Warning triangle with an exclamation mark, drawn in the current text colour. */
export default function Alert() {
	return (
		<svg width="100%" height="100%" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">
			<path d="M8 1L15.5 14.5H0.5Z" style="fill:currentColor;" />
			<path d="M7.1 5.5H8.9L8.6 10.5H7.4Z M7.1 11.6H8.9V13.2H7.1Z" style="fill:#1C2A32;" />
		</svg>
	);
}
