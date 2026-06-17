import type { Country, DischargeEvent } from '$lib/data/types';
import type { Spill } from './types';

export interface SpillSource {
	slug: string;
	name: string;
	region?: string;
	country: Country;
	lat: number;
	lon: number;
	company?: string;
	discharges: readonly DischargeEvent[];
}

/**
 * Fold the per-beach discharges the verdict precompute already gathered into one
 * national list. The same outfall can sit within range of two beaches, so it is
 * deduped to its nearest beach by the outfall's own coordinates, which identify
 * it reliably even when the feed gives no usable name. Ongoing spills come
 * first, then most recently started. Pure, so it is unit-tested.
 */
export function aggregateSpills(sources: readonly SpillSource[]): Spill[] {
	const byKey = new Map<string, Spill>();
	for (const source of sources) {
		for (const discharge of source.discharges) {
			const identity =
				discharge.lat !== undefined && discharge.lon !== undefined
					? `${discharge.lat.toFixed(5)},${discharge.lon.toFixed(5)}`
					: discharge.outfallName;
			const key = `${source.company ?? ''}|${identity}`;
			const candidate: Spill = {
				outfallName: discharge.outfallName,
				receivingWater: discharge.receivingWater,
				ongoing: discharge.ongoing,
				startedAt: discharge.startedAt,
				endedAt: discharge.endedAt,
				beachSlug: source.slug,
				beachName: source.name,
				region: source.region,
				country: source.country,
				lat: source.lat,
				lon: source.lon,
				distanceMetres: discharge.distanceMetres
			};
			const existing = byKey.get(key);
			if (!existing || candidate.distanceMetres < existing.distanceMetres) {
				byKey.set(key, candidate);
			}
		}
	}
	return [...byKey.values()].sort(
		(a, b) =>
			Number(b.ongoing) - Number(a.ongoing) || Date.parse(b.startedAt) - Date.parse(a.startedAt)
	);
}
