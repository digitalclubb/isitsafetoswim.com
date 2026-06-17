import { readSpills } from '$lib/map/kv';
import type { PageServerLoad } from './$types';

export const config = {
	runtime: 'nodejs22.x'
};

/**
 * Rendered server-side so the spills list is in the HTML for crawlers, and
 * edge-cached for five minutes. The blob itself is refreshed hourly by the map
 * cron, so this is plenty fresh.
 */
export const load: PageServerLoad = async ({ setHeaders }) => {
	const blob = await readSpills();
	setHeaders({
		'cache-control': 'public, s-maxage=300, stale-while-revalidate=600'
	});
	return { spills: blob?.spills ?? [], generatedAt: blob?.generatedAt ?? '' };
};
