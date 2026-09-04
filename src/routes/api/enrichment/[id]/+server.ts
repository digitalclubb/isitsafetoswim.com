import { error, json } from '@sveltejs/kit';
import { getLocationById, getLocationBySlug } from '$lib/data/locations';
import { fetchSampleHistory } from '$lib/live/history';
import type { RequestHandler } from './$types';

export const prerender = false;

export const config = {
	runtime: 'nodejs22.x'
};

/**
 * The sample-history sparkline, the one decoration the location page still
 * defers. It reads the rate-limited regulator sample host, which is what made a
 * cold render slow, and it cannot change the verdict. Sea temperature and the
 * tide used to come through here too; both are fast Open-Meteo calls and are
 * now server-rendered, so crawlers see them. History changes weekly, so a long
 * cache is safe.
 */
export const GET: RequestHandler = async ({ params, setHeaders, request }) => {
	const lookup = params.id ?? '';
	const location = getLocationById(lookup) ?? getLocationBySlug(lookup);
	if (!location) throw error(404, 'unknown location');

	const sampleHistory = await fetchSampleHistory(location, request.signal).catch(() => []);

	setHeaders({
		'cache-control': 'public, s-maxage=3600, stale-while-revalidate=86400',
		'content-type': 'application/json; charset=utf-8',
		vary: 'Accept-Encoding'
	});
	return json({ sampleHistory });
};
