import { distanceMetres } from '$lib/data/search-index';
import type { Verdict } from '$lib/data/types';
import type { MapPoint } from './types';

export interface NearbyPoint {
	point: MapPoint;
	distanceMetres: number;
}

/**
 * The nearest bathing waters rated Yes for today, closest first. This is the
 * map's core job ("which safe beach is closest to me") and the accessible,
 * no-JS equivalent of the coloured map. Beaches without a Yes verdict are
 * excluded so the list only ever offers somewhere safe to go.
 */
export function nearestSafe(
	origin: { lat: number; lon: number },
	points: readonly MapPoint[],
	colours: Record<string, Verdict>,
	limit = 6
): NearbyPoint[] {
	return points
		.filter((p) => colours[p.id] === 'yes')
		.map((point) => ({
			point,
			distanceMetres: distanceMetres(origin, { lat: point.lat, lon: point.lon })
		}))
		.sort((a, b) => a.distanceMetres - b.distanceMetres)
		.slice(0, limit);
}
