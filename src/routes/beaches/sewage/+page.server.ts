import { error } from '@sveltejs/kit';
import { getSpillLeague, getSpillLeaguePlaces } from '$lib/data/spill-league';
import type { PageServerLoad } from './$types';

export const prerender = true;

export const load: PageServerLoad = () => {
	const league = getSpillLeague('england');
	if (!league) throw error(500, 'No spill record available');

	return {
		year: league.year,
		// The hub is the national table. There is no separate England page: the
		// two would carry identical rows and compete for the same query.
		entries: league.entries.map((e) => ({
			slug: e.location.slug,
			name: e.location.name,
			region: e.location.region,
			spills: e.spills,
			overflows: e.overflows,
			changePct: e.changePct,
			changeFrom: e.changeFrom
		})),
		ranked: league.ranked,
		withRecord: league.withRecord,
		total: league.total,
		totalSpills: league.totalSpills,
		regions: getSpillLeaguePlaces().map((p) => ({ slug: p.slug, name: p.name })),
		generatedAt: league.generatedAt
	};
};
