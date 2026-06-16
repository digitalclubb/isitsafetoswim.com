import type { Location } from '$lib/data/types';
import { mapPool } from '$lib/util/pool';
import { haversineMetres } from './geo';
import { fetchJson } from './http';

const FLOOD_MONITORING = 'https://environment.data.gov.uk/flood-monitoring';

interface ReadingsResponse {
	items?: Array<{ dateTime?: string; value?: number }>;
}

interface RainStation {
	ref: string;
	lat: number;
	lon: number;
}

interface StationsResponse {
	items?: Array<{ stationReference?: string; notation?: string; lat?: number; long?: number }>;
}

function parseStations(body: StationsResponse): RainStation[] {
	const out: RainStation[] = [];
	for (const item of body.items ?? []) {
		const ref = item.stationReference ?? item.notation;
		if (ref && typeof item.lat === 'number' && typeof item.long === 'number') {
			out.push({ ref, lat: item.lat, lon: item.long });
		}
	}
	return out;
}

/**
 * Find the nearest active rainfall station and sum the hourly tip totals over
 * the last 24 hours. Returns null when no station is in range or the EA API
 * is unreachable. Coverage is England and Wales; for Scotland/NI we return
 * null and the verdict engine treats that the same as "no signal".
 *
 * The station list the EA returns for a `dist` query is not sorted by distance,
 * so we pick the true nearest ourselves with nearestStation, the same rule the
 * batch path uses, so the page and the map never read different stations.
 */
export async function fetchRainfall24h(
	point: { lat: number; lon: number },
	signal?: AbortSignal
): Promise<number | null> {
	const stationsUrl = `${FLOOD_MONITORING}/id/stations?parameter=rainfall&lat=${point.lat}&long=${point.lon}&dist=15`;
	let body: StationsResponse;
	try {
		body = await fetchJson<StationsResponse>(stationsUrl, { signal });
	} catch {
		return null;
	}
	const station = nearestStation(parseStations(body), point);
	if (!station) return null;
	return fetchStationRainfall(station.ref, signal);
}

/**
 * Sum hourly tip totals over a 24h readings window. Empty means the station is
 * in range but not reporting, which we cannot tell from a true zero, so we
 * return null and the engine treats it as "no signal".
 */
export function sumRainfall(items: Array<{ value?: number }>): number | null {
	if (items.length === 0) return null;
	let total = 0;
	let counted = 0;
	for (const r of items) {
		if (typeof r.value === 'number' && Number.isFinite(r.value)) {
			if (r.value > 0) total += r.value;
			counted += 1;
		}
	}
	if (counted === 0) return null;
	return Math.round(total * 10) / 10;
}

export function nearestStation(
	stations: readonly RainStation[],
	point: { lat: number; lon: number },
	maxMetres = 15_000
): RainStation | null {
	let best: RainStation | null = null;
	let bestMetres = Number.POSITIVE_INFINITY;
	for (const station of stations) {
		const metres = haversineMetres(point, { lat: station.lat, lon: station.lon });
		if (metres < bestMetres) {
			bestMetres = metres;
			best = station;
		}
	}
	return best && bestMetres <= maxMetres ? best : null;
}

async function fetchAllRainStations(signal?: AbortSignal): Promise<RainStation[]> {
	// _limit=10000 comfortably exceeds the rainfall station count (hundreds). If
	// the EA ever capped it lower, some beaches would fall back to a more distant
	// or null station, which fails safe (no rain signal).
	let body: StationsResponse;
	try {
		body = await fetchJson<StationsResponse>(
			`${FLOOD_MONITORING}/id/stations?parameter=rainfall&_limit=10000`,
			{ signal }
		);
	} catch {
		return [];
	}
	return parseStations(body);
}

async function fetchStationRainfall(ref: string, signal?: AbortSignal): Promise<number | null> {
	const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
	const url = `${FLOOD_MONITORING}/id/stations/${encodeURIComponent(
		ref
	)}/readings?parameter=rainfall&since=${encodeURIComponent(since)}&_limit=200&_sorted=`;
	let readings: ReadingsResponse;
	try {
		readings = await fetchJson<ReadingsResponse>(url, { signal });
	} catch {
		return null;
	}
	return sumRainfall(readings.items ?? []);
}

/**
 * Rainfall for every location in a handful of requests instead of two per
 * beach. Fetches the rainfall station list once, maps each beach to its nearest
 * station in memory, then reads only the unique stations that any beach needs.
 * Used by the map precompute to avoid hammering the flood-monitoring host.
 */
export async function fetchRainfallByLocation(
	locations: readonly Location[],
	signal?: AbortSignal
): Promise<Map<string, number | null>> {
	const result = new Map<string, number | null>();
	const stations = await fetchAllRainStations(signal);
	if (stations.length === 0) {
		for (const location of locations) result.set(location.id, null);
		return result;
	}

	const refByLocation = new Map<string, string | null>();
	const neededRefs = new Set<string>();
	for (const location of locations) {
		const station = nearestStation(stations, { lat: location.lat, lon: location.lon });
		refByLocation.set(location.id, station ? station.ref : null);
		if (station) neededRefs.add(station.ref);
	}

	const refs = [...neededRefs];
	const sums = await mapPool(refs, 5, (ref) => fetchStationRainfall(ref, signal));
	const mmByRef = new Map<string, number | null>();
	refs.forEach((ref, i) => {
		mmByRef.set(ref, sums[i]);
	});

	for (const location of locations) {
		const ref = refByLocation.get(location.id) ?? null;
		result.set(location.id, ref ? (mmByRef.get(ref) ?? null) : null);
	}
	return result;
}
