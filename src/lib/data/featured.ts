import { getLocationBySlug } from './locations';
import type { Location } from './types';

/**
 * Featured spots shown on the homepage. We hand-pick the best-known UK
 * swimming locations across all four nations rather than letting popularity
 * be inferred algorithmically — these are the queries users actually search.
 */
const FEATURED_SLUGS = [
	'brighton-central',
	'bournemouth-alum-chine',
	'blackpool-central',
	'scarborough-south-bay',
	'fistral-north',
	'aberystwyth-north',
	'st-andrews-west-sands',
	'portrush-curran-east-strand'
];

export function getFeaturedLocations(): Location[] {
	const out: Location[] = [];
	for (const slug of FEATURED_SLUGS) {
		const loc = getLocationBySlug(slug);
		if (loc) out.push(loc);
	}
	return out;
}
