import searchJson from '$data/search-index.json';
import type { Classification, Country } from './types';

export interface SearchLocation {
	id: string;
	slug: string;
	name: string;
	/** The regulator's own name, when the displayed one differs from it. */
	officialName?: string;
	country: Country;
	region?: string;
	classification: Classification;
	lat: number;
	lon: number;
}

interface SearchIndexFile {
	generatedAt: string;
	count: number;
	locations: SearchLocation[];
}

const index = searchJson as unknown as SearchIndexFile;

export function getSearchIndex(): readonly SearchLocation[] {
	return index.locations;
}

function foldDiacritics(input: string): string {
	return input.normalize('NFKD').replace(/[̀-ͯ]/g, '');
}

export function searchSlim(query: string, limit = 8): SearchLocation[] {
	const q = foldDiacritics(query.trim().toLowerCase());
	if (q.length < 2) return [];
	const out: Array<{ loc: SearchLocation; score: number }> = [];
	for (const loc of index.locations) {
		const name = foldDiacritics(loc.name.toLowerCase());
		// Someone reading the regulator's name off a beach board or an EA profile
		// searches for that, not for the name we chose to display.
		const official = foldDiacritics((loc.officialName ?? '').toLowerCase());
		const region = foldDiacritics((loc.region ?? '').toLowerCase());
		let score = 0;
		if (name === q) score = 100;
		else if (name.startsWith(q)) score = 60;
		else if (name.includes(q)) score = 30;
		else if (official === q) score = 50;
		else if (official.startsWith(q)) score = 25;
		else if (official.includes(q)) score = 20;
		else if (region.includes(q)) score = 15;
		if (score > 0) out.push({ loc, score });
	}
	out.sort((a, b) => b.score - a.score || a.loc.name.localeCompare(b.loc.name, 'en-GB'));
	return out.slice(0, limit).map((r) => r.loc);
}

export function distanceMetres(
	a: { lat: number; lon: number },
	b: { lat: number; lon: number }
): number {
	const R = 6_371_000;
	const toRad = (d: number) => (d * Math.PI) / 180;
	const dLat = toRad(b.lat - a.lat);
	const dLon = toRad(b.lon - a.lon);
	const lat1 = toRad(a.lat);
	const lat2 = toRad(b.lat);
	const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
	return 2 * R * Math.asin(Math.sqrt(h));
}

export function findNearestSlim(
	point: { lat: number; lon: number },
	limit = 5
): Array<{ location: SearchLocation; distanceMetres: number }> {
	const ranked = index.locations
		.map((location) => ({
			location,
			distanceMetres: distanceMetres(point, { lat: location.lat, lon: location.lon })
		}))
		.sort((a, b) => a.distanceMetres - b.distanceMetres);
	return ranked.slice(0, limit);
}
