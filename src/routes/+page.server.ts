import { getFeaturedLocations } from '#lib/data/featured.ts';
import { getIndexMeta } from '#lib/data/locations.ts';

export const prerender = true;

// Server-only: locations.ts carries all 701 full records, and a universal load
// shipped every one of them in the homepage bundle.
export const load = () => ({
	meta: getIndexMeta(),
	featured: getFeaturedLocations()
});
