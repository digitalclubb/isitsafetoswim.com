import { findNearestSlim } from '$lib/data/search-index';
import type { PageLoad } from './$types';

export const prerender = false;

const NEAR_LIMIT = 12;

export const load: PageLoad = ({ url }) => {
	const lat = Number(url.searchParams.get('lat'));
	const lon = Number(url.searchParams.get('lon'));
	if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
		return {
			heading: 'your location',
			results: [],
			emptyMessage: 'We could not read your location. Search by name or postcode instead.'
		};
	}
	return {
		heading: 'your location',
		results: findNearestSlim({ lat, lon }, NEAR_LIMIT)
	};
};
