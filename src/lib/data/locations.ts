import locationsJson from '$data/locations.json';
import type { Country, Location, LocationIndex } from './types';

const index = locationsJson as unknown as LocationIndex;

const bySlug = new Map<string, Location>();
const byId = new Map<string, Location>();
for (const loc of index.locations) {
	if (!loc.slug || !loc.id) {
		throw new Error(`location index has malformed row: ${JSON.stringify(loc)}`);
	}
	bySlug.set(loc.slug, loc);
	byId.set(loc.id, loc);
}

export function getAllLocations(): readonly Location[] {
	return index.locations;
}

export function getLocationBySlug(slug: string): Location | undefined {
	return bySlug.get(slug);
}

export function getLocationById(id: string): Location | undefined {
	return byId.get(id);
}

export function getLocationsByCountry(country: Country): Location[] {
	return index.locations.filter((l) => l.country === country);
}

export function getIndexMeta(): Pick<LocationIndex, 'generatedAt' | 'count' | 'byCountry'> {
	return {
		generatedAt: index.generatedAt,
		count: index.count,
		byCountry: index.byCountry
	};
}

/**
 * Lightweight, allocation-free name search. We rely on the index being small
 * enough (~700 sites) that a linear scan is faster than building any kind of
 * trie or full-text index for this workload.
 */
function foldDiacritics(input: string): string {
	return input.normalize('NFKD').replace(/[̀-ͯ]/g, '');
}

export function searchLocations(query: string, limit = 12): Location[] {
	const q = foldDiacritics(query.trim().toLowerCase());
	if (q.length < 2) return [];
	const out: Array<{ loc: Location; score: number }> = [];
	for (const loc of index.locations) {
		const name = foldDiacritics(loc.name.toLowerCase());
		const region = foldDiacritics((loc.region ?? '').toLowerCase());
		let score = 0;
		if (name === q) score = 100;
		else if (name.startsWith(q)) score = 60;
		else if (name.includes(q)) score = 30;
		else if (region.includes(q)) score = 15;
		else if (loc.slug.includes(q)) score = 10;
		if (score > 0) out.push({ loc, score });
	}
	out.sort((a, b) => b.score - a.score || a.loc.name.localeCompare(b.loc.name, 'en-GB'));
	return out.slice(0, limit).map((r) => r.loc);
}

/**
 * Haversine distance in metres. Plenty accurate for "nearest beach to me".
 */
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

export function findNearest(
	point: { lat: number; lon: number },
	limit = 5
): Array<{ location: Location; distanceMetres: number }> {
	const ranked = index.locations
		.map((location) => ({
			location,
			distanceMetres: distanceMetres(point, { lat: location.lat, lon: location.lon })
		}))
		.sort((a, b) => a.distanceMetres - b.distanceMetres);
	return ranked.slice(0, limit);
}
