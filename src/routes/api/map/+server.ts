import { readColours } from '#lib/map/kv.ts';
import type { RequestHandler } from './$types';

export const prerender = false;

/**
 * The verdict colour snapshot the map paints from. Edge-cached for 30 minutes
 * so KV is read at most twice an hour regardless of traffic, never per
 * visit. Falls back to an empty blob before the cron has populated the store.
 */
export const GET: RequestHandler = async ({ setHeaders }) => {
	const blob = await readColours();
	setHeaders({
		// A real snapshot caches for 30 minutes. A missing blob (before the cron
		// has run, or a KV blip) caches briefly so the map recovers quickly.
		'cache-control': blob
			? 'public, s-maxage=1800, stale-while-revalidate=3600'
			: 'public, s-maxage=60, stale-while-revalidate=300',
		'content-type': 'application/json; charset=utf-8'
	});
	return Response.json(blob ?? { generatedAt: '', colours: {} });
};
