import type { MapColours } from './types';

/**
 * Two runs of the hourly cron plus slack. A blob older than this is dropped
 * rather than shown as today's verdict, because stale data presented as
 * current is exactly the confusion the cards exist to avoid.
 */
const MAX_AGE_MS = 3 * 60 * 60 * 1000;

let pending: Promise<MapColours | null> | undefined;

/**
 * Today's precomputed verdicts, the same snapshot the map paints from, or null
 * when it is missing, stale or slow. Shared per page load, so a page with
 * several card grids makes one request.
 */
export function fetchTodayVerdicts(): Promise<MapColours | null> {
	pending ??= load();
	return pending;
}

async function load(): Promise<MapColours | null> {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), 8000);
	try {
		const res = await fetch('/api/map', { signal: controller.signal });
		if (!res.ok) return null;
		const blob: MapColours = await res.json();
		const age = Date.now() - Date.parse(blob.generatedAt);
		return Number.isFinite(age) && age <= MAX_AGE_MS ? blob : null;
	} catch {
		return null;
	} finally {
		clearTimeout(timer);
		// A failure must not stick for the life of the tab, or client-side
		// navigation would never retry.
		pending = undefined;
	}
}
