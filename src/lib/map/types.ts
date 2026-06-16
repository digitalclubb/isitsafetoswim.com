import type { Country, Verdict } from '$lib/data/types';

/**
 * The precomputed verdict snapshot the map reads. A few KB: one verdict per
 * location id, plus when it was computed. Pin geometry is static and lives in
 * the catalogue, never in here.
 */
export interface MapColours {
	generatedAt: string;
	colours: Record<string, Verdict>;
}

/** Static pin geometry, derived from the catalogue at build time. */
export interface MapPoint {
	id: string;
	slug: string;
	name: string;
	region?: string;
	country: Country;
	lat: number;
	lon: number;
}
