import { error, json } from '@sveltejs/kit';
import { getLocationById, getLocationBySlug } from '$lib/data/locations';
import { fetchSampleHistory } from '$lib/live/history';
import { fetchSeaTemperature } from '$lib/live/temperature';
import type { RequestHandler } from './$types';

export const prerender = false;

export const config = {
	runtime: 'nodejs22.x'
};

/**
 * The two decoration signals for the location page: the sample-history
 * sparkline and the sea temperature. Neither changes the verdict, so the page
 * renders its answer server-side and pulls these in after paint rather than
 * blocking the render on the rate-limited sample host. The sample history
 * changes weekly and the temperature hourly, so a long cache is safe.
 */
export const GET: RequestHandler = async ({ params, setHeaders, request }) => {
	const lookup = params.id ?? '';
	const location = getLocationById(lookup) ?? getLocationBySlug(lookup);
	if (!location) throw error(404, 'unknown location');

	const [historyResult, temperatureResult] = await Promise.allSettled([
		fetchSampleHistory(location, request.signal),
		fetchSeaTemperature(location, request.signal)
	]);

	setHeaders({
		'cache-control': 'public, s-maxage=3600, stale-while-revalidate=86400',
		'content-type': 'application/json; charset=utf-8',
		vary: 'Accept-Encoding'
	});
	return json({
		sampleHistory: historyResult.status === 'fulfilled' ? historyResult.value : [],
		seaTemperatureC: temperatureResult.status === 'fulfilled' ? temperatureResult.value : null
	});
};
