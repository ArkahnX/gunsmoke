import { onCleanup, onMount, For } from "solid-js";
import {
	effectModalEffects,
	effectModalPosition,
	effectModalSkillNames,
	setShowEffectModal,
	formatEffectDescription,
} from "../../store";

export default function EffectModal() {
	let ref: HTMLDivElement | undefined;

	const onOutsideClick = (e: MouseEvent) => {
		if (ref && !ref.contains(e.target as Node)) {
			setShowEffectModal(false);
		}
	};

	onMount(() => {
		const timeout = setTimeout(() => window.addEventListener("click", onOutsideClick), 0);
		onCleanup(() => {
			clearTimeout(timeout);
			window.removeEventListener("click", onOutsideClick);
		});
	});

	return (
		<div
			ref={ref}
			class="fixed z-60 max-h-96 w-90 overflow-y-auto rounded-md border border-[#3A3A3A] bg-[#1B1B1B] p-3 text-[#D0D0D0] shadow-2xl"
			style={{ top: `${effectModalPosition().y}px`, left: `${effectModalPosition().x}px` }}>
			<div class="flex flex-col gap-3">
				<For each={effectModalEffects()}>
					{(effect) => (
						<div class="flex flex-col">
							<div class="mb-1.5 border-b border-[#3A3A3A] pb-1.5 font-bold text-[#4FA8E8]">{effect.name}</div>
							<div innerHTML={formatEffectDescription(effect.description, effectModalSkillNames())}></div>
						</div>
					)}
				</For>
			</div>
		</div>
	);
}
