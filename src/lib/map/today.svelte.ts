import type { Verdict } from '#lib/data/types.ts';
import type { MapColours } from './types';

/**
 * Two runs of the hourly cron plus slack. A blob older than this is dropped
 * rather than shown as today's verdict, because stale data presented as
 * current is exactly the confusion the cards exist to avoid.
 */
const MAX_AGE_MS = 3 * 60 * 60 * 1000;

/** How long a tab keeps a loaded snapshot before the next mount refetches. */
const REFRESH_MS = 30 * 60 * 1000;

/**
 * Today's precomputed verdicts, the same snapshot the map paints from. Empty
 * until loadTodayVerdicts succeeds, and on the server, where it is never
 * filled: prerendered and ISR pages must not bake a "today" into their HTML.
 */
export const today = $state<{ colours: Record<string, Verdict>; generatedAt: string }>({
	colours: {},
	generatedAt: ''
});

let pending: Promise<void> | undefined;
let loadedAt = 0;
let watching = false;

/**
 * Call from onMount. Every card on a page shares one request, and a failure or
 * an old snapshot is retried on the next mount rather than sticking for the
 * life of the tab.
 */
export function loadTodayVerdicts(): Promise<void> {
	// A tab left open on one page never mounts again, so returning to it is
	// the other moment to refresh, or clear a snapshot past its age limit.
	if (!watching) {
		watching = true;
		document.addEventListener('visibilitychange', () => {
			if (document.visibilityState === 'visible') loadTodayVerdicts();
		});
	}
	if (Date.now() - loadedAt < REFRESH_MS) return Promise.resolve();
	pending ??= load().finally(() => {
		pending = undefined;
	});
	return pending;
}

async function load(): Promise<void> {
	// A tab left open must not keep showing a snapshot past its age limit
	// just because the refetch failed.
	if (Date.now() - Date.parse(today.generatedAt) > MAX_AGE_MS) {
		today.colours = {};
		today.generatedAt = '';
	}
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), 8000);
	try {
		const res = await fetch('/api/map', { signal: controller.signal });
		if (!res.ok) return;
		const blob: MapColours = await res.json();
		const age = Date.now() - Date.parse(blob.generatedAt);
		if (!Number.isFinite(age) || age > MAX_AGE_MS) return;
		today.colours = blob.colours ?? {};
		today.generatedAt = blob.generatedAt;
		loadedAt = Date.now();
	} catch {
		// Cards keep their annual classification and pins stay neutral.
	} finally {
		clearTimeout(timer);
	}
}
