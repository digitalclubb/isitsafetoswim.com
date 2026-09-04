import { error } from '@sveltejs/kit';
import { getSpillLeague, getSpillLeaguePlaces } from '$lib/data/spill-league';
import type { EntryGenerator, PageServerLoad } from './$types';

export const prerender = true;

export const entries: EntryGenerator = () => {
	return getSpillLeaguePlaces().map((p) => ({ place: p.slug }));
};

export const load: PageServerLoad = ({ params }) => {
	const league = getSpillLeague(params.place);
	if (!league) throw error(404, 'No sewage record for this area');

	return {
		place: league.place,
		parent: league.parent,
		year: league.year,
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
		childRegions: league.childRegions.map((p) => ({ slug: p.slug, name: p.name })),
		generatedAt: league.generatedAt
	};
};
