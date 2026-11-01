import { createEffect, createSignal, For, onCleanup, Show } from "solid-js";

/** The open dropdown, if any; opening one closes the rest so their lists can't overlap. */
const [openDropdown, setOpenDropdown] = createSignal<symbol | null>(null);

export default function Dropdown<T extends string>(props: {
	options: readonly T[];
	value: T;
	onChange: (value: T) => void;
	class?: string;
}) {
	const id = Symbol("dropdown");
	let root: HTMLDivElement | undefined;
	const [selected, setSelected] = createSignal<T>(props.value);
	createEffect(() => {
		setSelected(() => props.value);
	});
	/** Option under the mouse or keyboard cursor, separate from the selected one */
	const [cursor, setCursor] = createSignal(-1);
	const isOpen = () => openDropdown() === id;

	const open = () => {
		setCursor(Math.max(0, props.options.indexOf(selected())));
		setOpenDropdown(id);
	};
	const close = () => {
		if (isOpen()) setOpenDropdown(null);
	};
	const pick = (option: T) => {
		close();
		if (option === selected()) return;
		setSelected(() => option);
		props.onChange(option);
	};
	const moveCursor = (delta: number) => {
		const count = props.options.length;
		setCursor((index) => (index + delta + count) % count);
	};

	const onKeyDown = (e: KeyboardEvent) => {
		switch (e.key) {
			case "ArrowDown":
			case "ArrowUp":
				if (isOpen()) moveCursor(e.key === "ArrowDown" ? 1 : -1);
				else open();
				break;
			case "Enter":
			case " ":
				if (!isOpen()) open();
				else if (cursor() > -1) pick(props.options[cursor()]);
				break;
			case "Escape":
				if (!isOpen()) return;
				close();
				break;
			default:
				return;
		}
		e.preventDefault();
	};

	const onDocumentPointerDown = (e: PointerEvent) => {
		if (isOpen() && !root?.contains(e.target as Node)) close();
	};
	document.addEventListener("pointerdown", onDocumentPointerDown);
	onCleanup(() => {
		document.removeEventListener("pointerdown", onDocumentPointerDown);
		close();
	});

	return (
		<div
			ref={(el) => {
				root = el;
			}}
			class={`dropdown ${props.class ?? ""}`}
			data-open={isOpen()}
			onFocusOut={(e) => {
				// tabbing away closes it; clicks on the list keep focus on the button (see onMouseDown below)
				if (!root?.contains(e.relatedTarget as Node | null)) close();
			}}>
			<button
				type="button"
				class="dropdown-control"
				aria-haspopup="listbox"
				aria-expanded={isOpen()}
				onClick={() => {
					if (isOpen()) close();
					else open();
				}}
				onKeyDown={onKeyDown}>
				<span class="dropdown-value">{selected()}</span>
				<span class="dropdown-arrow">▾</span>
			</button>
			<Show when={isOpen()}>
				<ul
					class="dropdown-list"
					role="listbox"
					onMouseDown={(e) => {
						e.preventDefault();
					}}>
					<For each={props.options}>
						{(option, index) => (
							<li
								ref={(el) => {
									createEffect(() => {
										if (index() === cursor()) el.scrollIntoView({ block: "nearest" });
									});
								}}
								role="option"
								class="dropdown-option"
								aria-selected={option === selected()}
								data-selected={option === selected()}
								data-cursor={index() === cursor()}
								onPointerEnter={() => {
									setCursor(index());
								}}
								onClick={() => {
									pick(option);
								}}>
								{option}
							</li>
						)}
					</For>
				</ul>
			</Show>
		</div>
	);
}
