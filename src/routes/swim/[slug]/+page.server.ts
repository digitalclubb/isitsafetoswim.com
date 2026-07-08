import { error } from '@sveltejs/kit';
import { getLocationBySlug } from '$lib/data/locations';
import { getHubForLocation } from '$lib/data/places';
import { buildLiveData } from '$lib/live/verdict';
import type { PageServerLoad } from './$types';

export const config = {
	runtime: 'nodejs22.x',
	isr: {
		expiration: 300
	}
};

/**
 * The live verdict (sewage, rainfall, daily forecast, fresh sample) is built
 * on the server so the HTML ships with today's real answer, not a placeholder
 * that flips a moment later. Vercel ISR caches each render for five minutes and
 * serves stale-while-revalidate, so all but the occasional cache-miss request
 * is instant and never blocks on the regulator APIs.
 */
export const load: PageServerLoad = async ({ params, request, setHeaders }) => {
	const location = getLocationBySlug(params.slug);
	if (!location) throw error(404, 'Unknown bathing water');

	setHeaders({
		'cache-control': 'public, s-maxage=300, stale-while-revalidate=600'
	});

	const hub = getHubForLocation(location.country, location.region);

	return {
		location,
		live: await buildLiveData(location, request.signal),
		hub: { slug: hub.slug, name: hub.name }
	};
};
