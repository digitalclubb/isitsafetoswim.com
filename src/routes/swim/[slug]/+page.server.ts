import { error } from '@sveltejs/kit';
import { getLocationBySlug } from '$lib/data/locations';
import { getHubForLocation } from '$lib/data/places';
import { buildCachedData } from '$lib/live/verdict';
import type { PageServerLoad } from './$types';

export const config = {
	runtime: 'nodejs22.x',
	isr: {
		expiration: 3600
	}
};

/**
 * The page renders instantly from the build-time index. The live verdict
 * (sewage, rainfall, daily forecast, fresh sample) is fetched client-side
 * from /api/verdict/[id] after first paint, so navigation never blocks on
 * upstream regulator APIs.
 */
export const load: PageServerLoad = ({ params, setHeaders }) => {
	const location = getLocationBySlug(params.slug);
	if (!location) throw error(404, 'Unknown bathing water');

	setHeaders({
		'cache-control': 'public, s-maxage=3600, stale-while-revalidate=86400'
	});

	const hub = getHubForLocation(location.country, location.region);

	return {
		location,
		live: buildCachedData(location),
		hub: { slug: hub.slug, name: hub.name }
	};
};
