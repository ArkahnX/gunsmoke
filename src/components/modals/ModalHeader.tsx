export default function ModalHeader(props: { title: string }) {
	return (
		<div class="mb-1.75 flex flex-col">
			<h2 class="h-15 flex-1 content-center bg-[#C2C0C4] text-center text-3xl font-extrabold text-[#384B53]">{props.title}</h2>
			<div class="mt-1.75 border-t-3 border-[#B5B5B6]"></div>
		</div>
	);
}
