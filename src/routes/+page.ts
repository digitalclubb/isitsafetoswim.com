import { getFeaturedLocations } from '$lib/data/featured';
import { getIndexMeta } from '$lib/data/locations';
import { getSearchIndex } from '$lib/data/search-index';

export const prerender = true;

export const load = () => {
	return {
		meta: getIndexMeta(),
		featured: getFeaturedLocations(),
		searchIndex: getSearchIndex()
	};
};
