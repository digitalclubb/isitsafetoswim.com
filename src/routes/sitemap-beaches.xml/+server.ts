import { getTierSummaries } from '$lib/data/classifications';
import { getIndexMeta } from '$lib/data/locations';
import { getAllPlaces } from '$lib/data/places';
import { getSpillLeaguePlaces } from '$lib/data/spill-league';
import { buildDate, urlSet } from '$lib/seo/sitemap';

export const prerender = true;

/**
 * The area hub, every country and region page, the four classification pages
 * the classification-change page and the sewage league tables. All are derived from the catalogue, so they
 * share its build date.
 */
export const GET = () => {
	const lastmod = buildDate(getIndexMeta().generatedAt);

	return urlSet([
		{ path: '/beaches', lastmod },
		...getAllPlaces().map((place) => ({ path: `/beaches/${place.slug}`, lastmod })),
		...getTierSummaries().map((tier) => ({ path: `/beaches/rated/${tier.slug}`, lastmod })),
		{ path: '/beaches/changes', lastmod },
		{ path: '/beaches/sewage', lastmod },
		...getSpillLeaguePlaces().map((place) => ({
			path: `/beaches/sewage/${place.slug}`,
			lastmod
		}))
	]);
};
