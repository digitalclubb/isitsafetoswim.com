import { getIndexMeta } from '$lib/data/locations';
import { buildDate, sitemapIndex } from '$lib/seo/sitemap';

export const prerender = true;

/**
 * A sitemap index rather than one flat file, so Search Console reports
 * coverage per section instead of for the site as one lump, and the location
 * file has room to grow well clear of the 50,000-URL limit. The children all
 * share the catalogue's build date today, so the index does not yet narrow
 * what Google refetches.
 */
export const GET = () => {
	const lastmod = buildDate(getIndexMeta().generatedAt);

	return sitemapIndex([
		{ path: '/sitemap-pages.xml', lastmod },
		{ path: '/sitemap-swim.xml', lastmod },
		{ path: '/sitemap-beaches.xml', lastmod }
	]);
};
