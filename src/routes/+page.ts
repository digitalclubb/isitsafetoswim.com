import { getIndexMeta } from '$lib/data/locations';
import { getSearchIndex } from '$lib/data/search-index';
import { getFeaturedLocations } from '$lib/data/featured';

export const prerender = true;

export const load = () => {
	return {
		meta: getIndexMeta(),
		featured: getFeaturedLocations(),
		searchIndex: getSearchIndex()
	};
};
