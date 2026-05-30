import { getAllLocations, getIndexMeta } from '$lib/data/locations';
import { getFeaturedLocations } from '$lib/data/featured';

export const prerender = true;

export const load = () => {
	return {
		meta: getIndexMeta(),
		featured: getFeaturedLocations(),
		allLocations: getAllLocations()
	};
};
