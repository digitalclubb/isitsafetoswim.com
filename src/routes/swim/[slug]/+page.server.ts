import { error } from '@sveltejs/kit';
import { getLocationBySlug } from '$lib/data/locations';
import { buildLiveData } from '$lib/live/verdict';
import type { PageServerLoad } from './$types';

export const config = {
	runtime: 'nodejs22.x',
	isr: {
		expiration: 300
	}
};

export const load: PageServerLoad = async ({ params, setHeaders }) => {
	const location = getLocationBySlug(params.slug);
	if (!location) throw error(404, 'Unknown bathing water');

	const live = await buildLiveData(location);

	setHeaders({
		'cache-control': 'public, s-maxage=300, stale-while-revalidate=600'
	});

	return {
		location,
		live
	};
};
