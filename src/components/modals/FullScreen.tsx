import { children, JSX } from "solid-js";

export default function FullScreen(props: { children: JSX.Element }) {
	const resolved = children(() => props.children);
	return <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/90">{resolved()}</div>;
}
