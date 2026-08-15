import { error } from '@sveltejs/kit';
import { getRatingBySlug, tierSlug } from '$lib/data/classifications';
import { getIndexMeta } from '$lib/data/locations';
import { RATED_TIERS } from '$lib/data/rating';
import type { Location } from '$lib/data/types';
import type { EntryGenerator, PageServerLoad } from './$types';

export const prerender = true;

export const entries: EntryGenerator = () => RATED_TIERS.map((tier) => ({ tier: tierSlug(tier) }));

function toCard(l: Location) {
	return {
		slug: l.slug,
		name: l.name,
		region: l.region,
		country: l.country,
		classification: l.classification
	};
}

export const load: PageServerLoad = ({ params }) => {
	const page = getRatingBySlug(params.tier);
	if (!page) throw error(404, 'Unknown classification');

	return {
		tier: page.tier,
		slug: page.slug,
		meaning: page.meaning,
		total: page.total,
		byCountry: page.byCountry.map((group) => ({
			country: group.country,
			locations: group.locations.map(toCard)
		})),
		siblings: page.siblings,
		catalogueTotal: getIndexMeta().count,
		generatedAt: page.generatedAt
	};
};
