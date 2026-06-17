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

/** A storm-overflow discharge near a designated bathing water. */
export interface Spill {
	outfallName: string;
	receivingWater?: string;
	ongoing: boolean;
	startedAt: string;
	endedAt?: string;
	beachSlug: string;
	beachName: string;
	region?: string;
	country: Country;
	lat: number;
	lon: number;
	distanceMetres: number;
}

/** The precomputed national spills snapshot the /spills page reads. */
export interface SpillsBlob {
	generatedAt: string;
	spills: Spill[];
}
