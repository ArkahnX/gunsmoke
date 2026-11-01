/**
 * Blue "CN" tag for dolls, keys and weapons only out on the CN server, placed inside a `relative` image wrapper. `class`
 * replaces the default corner, layer and text size (`bottom-1 left-1 z-20 text-xs`), e.g. for small chips.
 */
export default function UnreleasedBadge(props: { class?: string }) {
	return (
		<div
			class={`pointer-events-none absolute rounded-sm bg-[#1E6FD9] px-1 leading-4 font-bold text-white ${props.class ?? "bottom-1 left-1 z-20 text-xs"}`}
			title="Unreleased (CN only)">
			CN
		</div>
	);
}
