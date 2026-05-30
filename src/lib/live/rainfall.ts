import { fetchJson } from './http';

const FLOOD_MONITORING = 'https://environment.data.gov.uk/flood-monitoring';

interface StationsResponse {
	items?: Array<{ stationReference?: string; notation?: string }>;
}

interface ReadingsResponse {
	items?: Array<{ dateTime?: string; value?: number }>;
}

/**
 * Find the nearest active rainfall station and sum the hourly tip totals over
 * the last 24 hours. Returns null when no station is in range or the EA API
 * is unreachable. Coverage is England and Wales; for Scotland/NI we return
 * null and the verdict engine treats that the same as "no signal".
 */
export async function fetchRainfall24h(
	point: { lat: number; lon: number },
	signal?: AbortSignal
): Promise<number | null> {
	const stationsUrl = `${FLOOD_MONITORING}/id/stations?parameter=rainfall&lat=${point.lat}&long=${point.lon}&dist=15&_limit=1`;
	let stations: StationsResponse;
	try {
		stations = await fetchJson<StationsResponse>(stationsUrl, { signal });
	} catch {
		return null;
	}
	const ref = stations.items?.[0]?.stationReference ?? stations.items?.[0]?.notation;
	if (!ref) return null;

	const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
	const readingsUrl = `${FLOOD_MONITORING}/id/stations/${encodeURIComponent(
		ref
	)}/readings?parameter=rainfall&since=${encodeURIComponent(since)}&_limit=200&_sorted=`;
	let readings: ReadingsResponse;
	try {
		readings = await fetchJson<ReadingsResponse>(readingsUrl, { signal });
	} catch {
		return null;
	}
	const items = readings.items ?? [];
	// Empty readings array means the station is in range but is not reporting,
	// which we cannot distinguish from a true zero. Treat as "no signal".
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
