import { getTierSummaries } from '$lib/data/classifications';
import { getAllPlaces } from '$lib/data/places';
import type { PageServerLoad } from './$types';

export const prerender = true;

export const load: PageServerLoad = () => {
	const all = getAllPlaces();
	const countries = all
		.filter((p) => p.kind === 'country')
		.sort((a, b) => b.count - a.count)
		.map((country) => ({
			country,
			regions: all
				.filter((p) => p.kind === 'region' && p.country === country.country)
				.sort((a, b) => a.name.localeCompare(b.name, 'en-GB'))
		}));
	return { countries, tiers: getTierSummaries() };
};
