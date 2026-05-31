import type { DischargeEvent, Location } from '$lib/data/types';
import { haversineMetres, osgb36ToWgs84 } from './geo';
import { fetchJson } from './http';

/**
 * Thames Water is the only large English/Welsh sewerage undertaker not on the
 * shared ArcGIS storm-overflow feeds, so its combined sewer overflow data
 * (which covers London and the tidal Thames) comes from its own open data API.
 *
 * Unlike the ArcGIS feeds this one authenticates with static client_id /
 * client_secret headers (not OAuth), returns one record per monitor for the
 * whole region rather than a spatial query, and reports coordinates as OSGB36
 * easting/northing which must be reprojected to WGS84. The full recent-activity
 * set is fetched once and cached in memory, then distance-filtered per site.
 *
 * Dormant until THAMES_WATER_CLIENT_ID and THAMES_WATER_CLIENT_SECRET are set;
 * with no credentials it returns no discharges, exactly as before.
 */
const STATUS_ENDPOINT =
	'https://prod-tw-opendata-app.uk-e1.cloudhub.io/data/STE/v1/DischargeCurrentStatus';
const MAX_DISTANCE_M = 10_000;
const RECENT_WINDOW_MS = 48 * 60 * 60 * 1000;
const TTL_MS = 5 * 60_000;

interface ThamesRecord {
	LocationName?: unknown;
	ReceivingWaterCourse?: unknown;
	X?: unknown;
	Y?: unknown;
	AlertStatus?: unknown;
	MostRecentDischargeAlertStart?: unknown;
	MostRecentDischargeAlertStop?: unknown;
	StatusChange?: unknown;
}

interface LocatedDischarge {
	lat: number;
	lon: number;
	ongoing: boolean;
	startedAt: string;
	endedAt?: string;
	outfallName: string;
	receivingWater?: string;
}

function num(value: unknown): number | undefined {
	const n =
		typeof value === 'string' ? Number(value) : typeof value === 'number' ? value : Number.NaN;
	return Number.isFinite(n) ? n : undefined;
}

function str(value: unknown): string | undefined {
	return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function iso(value: unknown): string | undefined {
	const s = str(value);
	if (!s) return undefined;
	const t = Date.parse(s);
	return Number.isFinite(t) ? new Date(t).toISOString() : undefined;
}

/**
 * Pure: normalise one DischargeCurrentStatus record into a located discharge,
 * reprojecting its OSGB36 coordinates, or null when it lacks usable coordinates
 * or timing. Exported for unit testing.
 */
export function parseThamesRecord(raw: ThamesRecord): LocatedDischarge | null {
	const x = num(raw.X);
	const y = num(raw.Y);
	if (x === undefined || y === undefined) return null;
	const { lat, lon } = osgb36ToWgs84(x, y);

	const status = str(raw.AlertStatus)?.toLowerCase() ?? '';
	const ongoing = /discharg/.test(status) && !/not[\s-]*discharg/.test(status);
	const startedAt = iso(raw.MostRecentDischargeAlertStart) ?? iso(raw.StatusChange);
	const endedAt = iso(raw.MostRecentDischargeAlertStop);
	// Without a start we cannot reason about recency, and a finished event needs
	// an end time to enter the horizon filter.
	if (!startedAt) return null;
	if (!ongoing && !endedAt) return null;

	return {
		lat,
		lon,
		ongoing,
		startedAt,
		endedAt: ongoing ? undefined : endedAt,
		outfallName: str(raw.LocationName) ?? 'Outfall',
		receivingWater: str(raw.ReceivingWaterCourse)
	};
}

let cache: { at: number; located: LocatedDischarge[] } | null = null;
let inflight: Promise<LocatedDischarge[]> | null = null;

async function loadThamesDischarges(signal?: AbortSignal): Promise<LocatedDischarge[]> {
	const clientId = process.env.THAMES_WATER_CLIENT_ID;
	const clientSecret = process.env.THAMES_WATER_CLIENT_SECRET;
	if (!clientId || !clientSecret) return [];

	if (cache && Date.now() - cache.at < TTL_MS) return cache.located;
	if (inflight) return inflight;

	inflight = (async () => {
		try {
			const url = `${STATUS_ENDPOINT}?col_1=AlertPast48Hours&operand_1=eq&value_1=true`;
			const body = await fetchJson<unknown>(url, {
				signal,
				headers: { client_id: clientId, client_secret: clientSecret }
			});
			const items = Array.isArray(body)
				? (body as ThamesRecord[])
				: ((body as { items?: ThamesRecord[] }).items ?? []);
			const located = items.map(parseThamesRecord).filter((d): d is LocatedDischarge => d !== null);
			cache = { at: Date.now(), located };
			return located;
		} catch {
			return cache?.located ?? [];
		} finally {
			inflight = null;
		}
	})();
	return inflight;
}

export async function fetchThamesDischarges(
	location: Location,
	signal?: AbortSignal
): Promise<DischargeEvent[]> {
	const located = await loadThamesDischarges(signal);
	if (located.length === 0) return [];

	const centre = { lat: location.lat, lon: location.lon };
	const horizon = Date.now() - RECENT_WINDOW_MS;
	const events: DischargeEvent[] = [];
	for (const d of located) {
		const distanceMetres = Math.round(haversineMetres(centre, { lat: d.lat, lon: d.lon }));
		if (distanceMetres > MAX_DISTANCE_M) continue;
		const reference = Date.parse(d.endedAt ?? d.startedAt);
		if (!d.ongoing && Number.isFinite(reference) && reference < horizon) continue;
		events.push({
			outfallName: d.outfallName,
			receivingWater: d.receivingWater,
			distanceMetres,
			startedAt: d.startedAt,
			endedAt: d.ongoing ? undefined : d.endedAt,
			ongoing: d.ongoing
		});
	}
	events.sort((a, b) => a.distanceMetres - b.distanceMetres);
	return events;
}
