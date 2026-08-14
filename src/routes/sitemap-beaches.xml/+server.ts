import { getIndexMeta } from '$lib/data/locations';
import { getAllPlaces } from '$lib/data/places';
import { buildDate, urlSet } from '$lib/seo/sitemap';

export const prerender = true;

/** The area hub and every country and region page derived from the catalogue. */
export const GET = () => {
	const lastmod = buildDate(getIndexMeta().generatedAt);

	return urlSet([
		{ path: '/beaches', lastmod },
		...getAllPlaces().map((place) => ({ path: `/beaches/${place.slug}`, lastmod }))
	]);
};
