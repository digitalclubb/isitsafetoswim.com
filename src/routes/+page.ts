import { getFeaturedLocations } from '#lib/data/featured.ts';
import { getIndexMeta } from '#lib/data/locations.ts';
import { getSearchIndex } from '#lib/data/search-index.ts';

export const prerender = true;

export const load = () => {
	return {
		meta: getIndexMeta(),
		featured: getFeaturedLocations(),
		searchIndex: getSearchIndex()
	};
};
