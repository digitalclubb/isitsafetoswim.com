import { error } from '@sveltejs/kit';
import { getLocationBySlug } from '$lib/data/locations';
import { getHubForLocation } from '$lib/data/places';
import { getSpillHistory } from '$lib/data/spill-history';
import { getSpillLeaguePlaces } from '$lib/data/spill-league';
import { buildPageData, type CachedSignals } from '$lib/live/verdict';
import { readProfiles, readRainfall } from '$lib/map/kv';
import { rainfallFrom } from '$lib/map/precompute';
import type { PageServerLoad } from './$types';

export const config = {
	runtime: 'nodejs22.x',
	isr: {
		expiration: 300
	}
};

/**
 * The verdict is built on the server so the HTML ships with today's real
 * answer, not a placeholder that flips a moment later. Forecast, sample and
 * discharges are fetched live; the precomputed cache supplies the 24h rainfall
 * total and stands in for the profile when the regulator host is slow or
 * blocked. Vercel ISR caches each render for five minutes and serves
 * stale-while-revalidate on top, so the live fetches rarely block a visitor.
 *
 * Both Redis reads are started here but awaited inside buildPageData, alongside
 * the live fetches rather than ahead of them. The chain cannot reject, so the
 * unawaited promise is never an unhandled rejection: a missing, unreachable or
 * stale store reads as null, which the verdict engine treats as "no signal".
 */
export const load: PageServerLoad = async ({ params, request, setHeaders }) => {
	const location = getLocationBySlug(params.slug);
	if (!location) throw error(404, 'Unknown bathing water');

	setHeaders({
		'cache-control': 'public, s-maxage=300, stale-while-revalidate=600'
	});

	const hub = getHubForLocation(location.country, location.region);
	// Only offer the league link where that area actually has a table, so the
	// spill section never points at a 404 for a region below the size cut-off.
	// England has no [place] page of its own: the hub carries the national table.
	const leaguePath = getSpillLeaguePlaces().some((p) => p.slug === hub.slug)
		? `/beaches/sewage/${hub.slug}`
		: location.country === 'England'
			? '/beaches/sewage'
			: null;
	const cached: Promise<CachedSignals> = Promise.all([readProfiles(), readRainfall()])
		.then(([profiles, rain]) => ({
			profile: profiles?.profiles[location.id] ?? null,
			rainfall24hMm: rainfallFrom(rain, location.id, new Date())
		}))
		.catch(() => ({ profile: null, rainfall24hMm: null }));

	return {
		location,
		live: await buildPageData(location, cached, request.signal),
		hub: { slug: hub.slug, name: hub.name, leaguePath },
		spillHistory: getSpillHistory(location.slug)
	};
};
