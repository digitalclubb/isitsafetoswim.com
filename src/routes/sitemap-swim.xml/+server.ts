import { getAllLocations, getIndexMeta } from '$lib/data/locations';
import { buildDate, urlSet } from '$lib/seo/sitemap';

export const prerender = true;

/**
 * Every bathing water. The catalogue records one build timestamp and no
 * per-location change date, so every entry shares the same lastmod. That is
 * the honest answer: inventing per-URL variation Google could disprove would
 * cost more trust than a uniform date does.
 */
export const GET = () => {
	const lastmod = buildDate(getIndexMeta().generatedAt);

	return urlSet(getAllLocations().map((loc) => ({ path: `/swim/${loc.slug}`, lastmod })));
};
