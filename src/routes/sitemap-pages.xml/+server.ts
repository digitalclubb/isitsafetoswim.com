import { getIndexMeta } from '$lib/data/locations';
import { buildDate, urlSet } from '$lib/seo/sitemap';

export const prerender = true;

/**
 * The standing pages. Only the ones whose content is derived from the
 * catalogue carry a lastmod, because those are the only ones whose change
 * date the build actually knows.
 */
export const GET = () => {
	const lastmod = buildDate(getIndexMeta().generatedAt);

	return urlSet([
		{ path: '/', lastmod },
		{ path: '/map', lastmod },
		{ path: '/spills' },
		{ path: '/about' }
	]);
};
