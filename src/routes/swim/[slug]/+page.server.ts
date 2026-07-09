import { error } from '@sveltejs/kit';
import { getLocationBySlug } from '$lib/data/locations';
import { getHubForLocation } from '$lib/data/places';
import { buildPageData } from '$lib/live/verdict';
import { readProfiles } from '$lib/map/kv';
import type { PageServerLoad } from './$types';

export const config = {
	runtime: 'nodejs22.x',
	isr: {
		expiration: 300
	}
};

/**
 * The verdict is built on the server so the HTML ships with today's real
 * answer, not a placeholder that flips a moment later. Forecast, sample,
 * discharges and rainfall are all fetched live; the precomputed profile cache
 * is passed in only as a fallback for when the regulator host is slow or
 * blocked. Vercel ISR caches each render for five minutes and serves
 * stale-while-revalidate on top, so the live fetches rarely block a visitor.
 */
export const load: PageServerLoad = async ({ params, request, setHeaders }) => {
	const location = getLocationBySlug(params.slug);
	if (!location) throw error(404, 'Unknown bathing water');

	setHeaders({
		'cache-control': 'public, s-maxage=300, stale-while-revalidate=600'
	});

	const hub = getHubForLocation(location.country, location.region);
	const cachedProfile = (await readProfiles())?.profiles[location.id] ?? null;

	return {
		location,
		live: await buildPageData(location, cachedProfile, request.signal),
		hub: { slug: hub.slug, name: hub.name }
	};
};
