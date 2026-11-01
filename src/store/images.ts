import { createSignal } from "solid-js";
import { DollId, SummonId, EnemyId, Enemy, Summon, Doll } from "../../gfl2-data/types";
import { log } from "../log";
import Immobile from "../components/icons/Immobile";
import { state } from "./appState";
import { combinedDolls, combinedKeys, combinedWeapons, getSelectedDoll } from "./gameData";

/** How long a preload waits for one image; a stalled request mustn't block importing a timeline. */
const IMAGE_TIMEOUT_MS = 10_000;

export const entityIdToImage = new Map<DollId | SummonId | EnemyId, HTMLImageElement>();

/** Counts images that have finished loading, so canvases drawn once (the summary) can redraw when one arrives. */
export const [imagesLoaded, setImagesLoaded] = createSignal(0);

/** Each entity's current load, so preloading again waits on the request in flight instead of replacing it. */
const imageLoads = new Map<DollId | SummonId | EnemyId, { src: string; done: Promise<void> }>();

/**
 * Loads the entity's icon for the canvas. Always settles: on load, on error, or after `IMAGE_TIMEOUT_MS` (the image
 * still appears if it arrives later). Only reloads when the entity's icon changed.
 */
export function attachImageToDoll(dollInfo: Doll | Summon | Enemy): Promise<void> {
	// dolls have an icon set; summons and enemies have a single icon
	const src = "icons" in dollInfo ? dollInfo.icons.avatar : dollInfo.icon;
	const existing = imageLoads.get(dollInfo.id);
	if (existing?.src === src) return existing.done;

	const img = new Image();
	const done = new Promise<void>((resolve) => {
		const timeout = setTimeout(() => {
			log.warn(`Image for ${dollInfo.id} is still loading after ${IMAGE_TIMEOUT_MS / 1000}s; continuing without it`, src);
			resolve();
		}, IMAGE_TIMEOUT_MS);
		img.onload = () => {
			clearTimeout(timeout);
			setImagesLoaded((count) => count + 1);
			resolve();
		};
		// a missing image must not block loading; the entity just renders without it
		img.onerror = () => {
			clearTimeout(timeout);
			log.warn(`Failed to load image for ${dollInfo.id}`, src);
			resolve();
		};
	});
	// handlers first, so the result can't be missed
	img.src = src;
	entityIdToImage.set(dollInfo.id, img);
	imageLoads.set(dollInfo.id, { src, done });
	return done;
}

export async function preloadCanvasImages(): Promise<void> {
	const entries = [];
	const selectedDolls = state.selectedDolls;
	for (const selectedDoll of selectedDolls) {
		const doll = getSelectedDoll(selectedDoll);
		entries.push(attachImageToDoll(doll));
		for (const summon of doll.summons) {
			entries.push(attachImageToDoll(summon));
		}
	}
	await Promise.all(entries);
}

let immobileIcon: HTMLImageElement | undefined;

/**
 * The chips' immobile icon as an image for the map, rendered from the same SVG component so the two always match;
 * undefined until it has loaded.
 */
export function getImmobileIcon(): HTMLImageElement | undefined {
	if (!immobileIcon) {
		const svg = Immobile() as SVGSVGElement;
		// a fixed size, since the component fills its container; drawn smaller, so this keeps it sharp when zoomed
		svg.setAttribute("width", "154");
		svg.setAttribute("height", "154");
		immobileIcon = new Image();
		immobileIcon.onload = () => setImagesLoaded((count) => count + 1);
		immobileIcon.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(new XMLSerializer().serializeToString(svg))}`;
	}
	return immobileIcon.complete && immobileIcon.naturalWidth > 0 ? immobileIcon : undefined;
}

/** How many prefetches run at once, leaving connections free for images the page actually needs. */
const PREFETCH_CONCURRENCY = 4;

/** Held so the browser keeps the prefetched images in its memory cache for when a modal mounts its own copies. */
const prefetchedImages: HTMLImageElement[] = [];

/**
 * Warms the cache with the images the doll, key and weapon modals show, so opening one doesn't wait on the network.
 * Runs once the browser is idle, in the order the modals are most likely to need them.
 */
export function prefetchModalImages() {
	const idle = window.requestIdleCallback ?? ((callback: () => void) => setTimeout(callback, 0));
	idle(() => {
		const dolls = Object.values(combinedDolls.data);
		const srcs = new Set<string>([
			...dolls.map((doll) => doll.icons.avatar),
			...Object.values(combinedKeys.data).map((key) => key.icon),
			...dolls.map((doll) => doll.icons.chibi),
			...Object.values(combinedWeapons.data).map((weapon) => weapon.icon),
		]);
		srcs.delete("");
		const queue = [...srcs];
		const next = () => {
			const src = queue.shift();
			if (src === undefined) return;
			const img = new Image();
			img.fetchPriority = "low";
			img.onload = img.onerror = next;
			img.src = src;
			prefetchedImages.push(img);
		};
		for (let i = 0; i < PREFETCH_CONCURRENCY; i++) next();
	});
}

/**
 * The entity's image once it has loaded; undefined while loading or if it failed. Drawing a failed image throws,
 * which would stop the canvas render loop, so the canvas only draws what this returns.
 */
export function getImageForEntity(entityId: DollId | SummonId | EnemyId): HTMLImageElement | undefined {
	const image = entityIdToImage.get(entityId);
	return image?.complete && image.naturalWidth > 0 ? image : undefined;
}
