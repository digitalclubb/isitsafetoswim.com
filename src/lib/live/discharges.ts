import type { DischargeEvent, Location } from '$lib/data/types';
import { haversineMetres } from './geo';
import { fetchJson } from './http';
import { fetchThamesDischarges } from './thames';

/**
 * Map an EA-reported sewerage undertaker to a public ArcGIS FeatureServer.
 * Each endpoint exposes near-real-time event monitoring for storm overflows
 * with at least: a status flag (1 discharging / 0 not), the latest start and
 * end timestamps, the receiving water, and a point geometry in WGS84.
 *
 * The layer names vary between companies; we keep one canonical URL per
 * company and standardise the fields downstream. Companies not yet mapped
 * fall through to an empty result, which the engine treats the same way as
 * "no signal available".
 */
const OVERFLOW_ENDPOINTS: Record<string, string> = {
	'Anglian Water Services Limited':
		'https://services3.arcgis.com/VCOY1atHWVcDlvlJ/arcgis/rest/services/stream_service_outfall_locations_view/FeatureServer/0/query',
	'Southern Water Services Limited':
		'https://services-eu1.arcgis.com/6qJmARkS2dt2IjVA/arcgis/rest/services/SouthernWater_StormOverflowActivity_PROD_view/FeatureServer/0/query',
	'Northumbrian Water Limited':
		'https://services-eu1.arcgis.com/MSNNjkZ51iVh8yBj/arcgis/rest/services/Northumbrian_Water_Storm_Overflows_PROD/FeatureServer/0/query',
	'South West Water Limited':
		'https://services-eu1.arcgis.com/OMdMOtfhATJPcHe3/arcgis/rest/services/NEH_outlets_PROD/FeatureServer/0/query',
	'Yorkshire Water Services Ltd':
		'https://services-eu1.arcgis.com/1WqkK5cDKUbF0CkH/arcgis/rest/services/YW_Storm_Overflow_Activity/FeatureServer/0/query',
	'United Utilities Water Limited':
		'https://services5.arcgis.com/5eoLvR0f8HKb7HWP/arcgis/rest/services/United_Utilities_Storm_Overflow_Activity/FeatureServer/0/query',
	'Severn Trent Water Limited':
		'https://services1.arcgis.com/NO7lTIlnxRMMG9Gw/arcgis/rest/services/Severn_Trent_Storm_Overflow_Activity/FeatureServer/0/query',
	'Wessex Water Services Limited':
		'https://services.arcgis.com/3SZ6e0uCvPROr4mS/arcgis/rest/services/Wessex_Water_Storm_Overflow_Activity/FeatureServer/0/query',
	'Dwr Cymru Cyfyngedig':
		'https://services3.arcgis.com/KLNF7YxtENPLYVey/arcgis/rest/services/DCWW_Storm_Overflow_Activity/FeatureServer/0/query'
};

function normaliseOperatorKey(input: string): string {
	return input
		.toLowerCase()
		.replace(/\bwater\b/g, '')
		.replace(/\bservices\b/g, '')
		.replace(/\blimited\b|\bltd\b/g, '')
		.replace(/cyfyngedig/g, '')
		.replace(/[^a-z]+/g, '');
}

const NORMALISED_ENDPOINTS = new Map<string, string>();
for (const [name, url] of Object.entries(OVERFLOW_ENDPOINTS)) {
	NORMALISED_ENDPOINTS.set(normaliseOperatorKey(name), url);
}

function lookupEndpoint(name: string | undefined): string | undefined {
	if (!name) return undefined;
	const direct = OVERFLOW_ENDPOINTS[name];
	if (direct) return direct;
	const key = normaliseOperatorKey(name);
	const fuzzy = NORMALISED_ENDPOINTS.get(key);
	if (fuzzy) return fuzzy;
	return undefined; // Thames Water is on its own API, handled in fetchRecentDischarges.
}

function isThamesWater(name: string | undefined): boolean {
	return Boolean(name) && normaliseOperatorKey(name as string).includes('thames');
}

interface FeatureCollection {
	features?: Array<{
		geometry?: { coordinates?: number[] };
		properties?: Record<string, unknown>;
	}>;
}

function metresPerDegreeLat(): number {
	return 111_320;
}

function metresPerDegreeLon(lat: number): number {
	return 111_320 * Math.cos((lat * Math.PI) / 180);
}

function bbox(centre: { lat: number; lon: number }, radiusMetres: number) {
	const dLat = radiusMetres / metresPerDegreeLat();
	const dLon = radiusMetres / metresPerDegreeLon(centre.lat);
	return {
		minLat: centre.lat - dLat,
		maxLat: centre.lat + dLat,
		minLon: centre.lon - dLon,
		maxLon: centre.lon + dLon
	};
}

function parseDate(value: unknown): string | undefined {
	if (typeof value === 'number' && Number.isFinite(value)) {
		return new Date(value).toISOString();
	}
	if (typeof value === 'string') {
		const t = Date.parse(value);
		return Number.isFinite(t) ? new Date(t).toISOString() : undefined;
	}
	return undefined;
}

function readString(props: Record<string, unknown>, keys: string[]): string | undefined {
	for (const k of keys) {
		const v = props[k];
		if (typeof v === 'string' && v.trim()) return v.trim();
	}
	return undefined;
}

function buildEvent(
	props: Record<string, unknown>,
	geometry: { coordinates?: number[] } | undefined,
	centre: { lat: number; lon: number }
): DischargeEvent | null {
	const lon = Number(geometry?.coordinates?.[0]);
	const lat = Number(geometry?.coordinates?.[1]);
	if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
	const status = props.Status ?? props.status ?? props.AlertStatus;
	const ongoing =
		status === 1 || status === '1' || (typeof status === 'string' && /discharg/i.test(status));
	const startedAt =
		parseDate(props.StatusStart) ??
		parseDate(props.LatestEventStart) ??
		parseDate(props.start_time) ??
		parseDate(props.StatusChange);
	const endedAt =
		parseDate(props.LatestEventEnd) ?? parseDate(props.end_time) ?? parseDate(props.StatusEnd);

	// Without a real start timestamp we cannot reason about recency, so drop
	// the event rather than synthesise a "now" fallback. Same for non-ongoing
	// events with no end time — they cannot enter the horizon filter sensibly.
	if (!startedAt) return null;
	if (!ongoing && !endedAt) return null;

	const outfallName =
		readString(props, ['Id', 'OutfallName', 'Outfall_Name', 'SiteName', 'Asset_ID', 'name']) ??
		'Outfall';
	const receivingWater = readString(props, [
		'ReceivingWaterCourse',
		'Receiving Water',
		'ReceivingWater',
		'Receiving_Water'
	]);
	return {
		outfallName,
		receivingWater,
		distanceMetres: Math.round(haversineMetres(centre, { lat, lon })),
		startedAt,
		endedAt: ongoing ? undefined : endedAt,
		ongoing
	};
}

export async function fetchRecentDischarges(
	location: Location,
	signal?: AbortSignal
): Promise<DischargeEvent[]> {
	const endpoint = lookupEndpoint(location.sewerageUndertaker);
	if (!endpoint) {
		if (isThamesWater(location.sewerageUndertaker)) {
			return fetchThamesDischarges(location, signal);
		}
		return [];
	}
	const centre = { lat: location.lat, lon: location.lon };
	const box = bbox(centre, 10_000);
	const where = encodeURIComponent('1=1');
	const url = `${endpoint}?where=${where}&outFields=*&f=geojson&outSR=4326&geometry=${box.minLon},${box.minLat},${box.maxLon},${box.maxLat}&geometryType=esriGeometryEnvelope&spatialRel=esriSpatialRelIntersects`;
	let body: FeatureCollection;
	try {
		body = await fetchJson<FeatureCollection>(url, { signal });
	} catch {
		return [];
	}
	const events: DischargeEvent[] = [];
	const horizon = Date.now() - 48 * 60 * 60 * 1000;
	for (const feature of body.features ?? []) {
		const event = buildEvent(feature.properties ?? {}, feature.geometry, centre);
		if (!event) continue;
		if (event.distanceMetres > 10_000) continue;
		const referenceTime = Date.parse(event.endedAt ?? event.startedAt);
		if (!event.ongoing && Number.isFinite(referenceTime) && referenceTime < horizon) continue;
		events.push(event);
	}
	events.sort((a, b) => a.distanceMetres - b.distanceMetres);
	return events;
}
