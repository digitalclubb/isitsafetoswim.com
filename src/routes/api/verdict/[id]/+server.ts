import { error, json } from '@sveltejs/kit';
import { getLocationById, getLocationBySlug } from '$lib/data/locations';
import { buildLiveData } from '$lib/live/verdict';
import type { RequestHandler } from './$types';

export const prerender = false;

export const config = {
	runtime: 'nodejs22.x'
};

export const GET: RequestHandler = async ({ params, setHeaders, request }) => {
	const lookup = params.id ?? '';
	const location = getLocationById(lookup) ?? getLocationBySlug(lookup);
	if (!location) throw error(404, 'unknown location');

	const data = await buildLiveData(location, request.signal);

	setHeaders({
		'cache-control': 'public, s-maxage=300, stale-while-revalidate=600',
		'content-type': 'application/json; charset=utf-8',
		vary: 'Accept-Encoding'
	});
	return json(data);
};
