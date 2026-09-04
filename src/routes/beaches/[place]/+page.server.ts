import { error } from '@sveltejs/kit';
import { getAllPlaces, getPlaceBySlug } from '$lib/data/places';
import type { Location } from '$lib/data/types';
import type { EntryGenerator, PageServerLoad } from './$types';

export const prerender = true;

export const entries: EntryGenerator = () => {
	return getAllPlaces().map((p) => ({ place: p.slug }));
};

function toCard(l: Location) {
	return {
		slug: l.slug,
		name: l.name,
		region: l.region,
		country: l.country,
		classification: l.classification,
		currentAssessment: l.currentAssessment
	};
}

export const load: PageServerLoad = ({ params }) => {
	const data = getPlaceBySlug(params.place);
	if (!data) throw error(404, 'Unknown area');

	return {
		place: data.place,
		parent: data.parent,
		classified: data.classified,
		cleanest: data.cleanest.map(toCard),
		ranked: data.ranked.map(toCard),
		countsByClass: data.countsByClass,
		childRegions: data.childRegions,
		generatedAt: data.generatedAt
	};
};
