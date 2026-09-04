import type { DischargeEvent, Location } from '$lib/data/types';
import { parseLondonNaive } from '$lib/util/time';
import { haversineMetres, osgb36ToWgs84 } from './geo';
import { fetchJson } from './http';

/**
 * Thames Water is the only large English/Welsh sewerage undertaker not on the
 * shared ArcGIS storm-overflow feeds, so its combined sewer overflow data
 * (covering London and the tidal Thames) comes from its own open data API.
 *
 * The v2 API is fully open: no key, no OAuth, a plain GET. It returns one record
 * per monitor for the whole region (no spatial query) with coordinates as OSGB36
 * easting/northing, which must be reprojected to WGS84. We fetch and parse the
 * set once, cache it in memory for five minutes, then apply the distance and
 * 48-hour recency gates per site.
 *
 *   https://docs.api.thameswater.co.uk/   (licence: data.thameswater.co.uk/s/terms-of-service)
 */
const STATUS_ENDPOINT = 'https://api.thameswater.co.uk/opendata/v2/discharge/status';
const PAGE_SIZE = 1000;
const MAX_PAGES = 5;
const MAX_DISTANCE_M = 10_000;
const RECENT_WINDOW_MS = 48 * 60 * 60 * 1000;
const TTL_MS = 5 * 60_000;

type ThamesRecord = Record<string, unknown>;

interface LocatedDischarge {
	lat: number;
	lon: number;
	ongoing: boolean;
	startedAt: string;
	endedAt?: string;
	outfallName: string;
	receivingWater?: string;
}

function pick(raw: ThamesRecord, keys: string[]): unknown {
	for (const k of keys) {
		const v = raw[k];
		if (v !== undefined && v !== null) return v;
	}
	return undefined;
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
	// Thames timestamps are UK local with no timezone, the same as Welsh Water's.
	// This used to append a Z and accept the BST skew on the grounds that the
	// verdict windows are coarse; it now shares parseLondonNaive with the other
	// feeds, so no two feeds disagree about what a naive timestamp means and a
	// summer spill is never dated an hour into the future.
	const t = parseLondonNaive(s);
	return t === null ? undefined : new Date(t).toISOString();
}

function isDischarging(status: string | undefined): boolean {
	const s = status?.toLowerCase() ?? '';
	return /discharg/.test(s) && !/not[\s-]*discharg/.test(s);
}

/**
 * Pure: normalise one discharge/status record into a located discharge,
 * reprojecting its OSGB36 coordinates, or null when it lacks usable coordinates
 * or timing. Reads the v2 camelCase fields and tolerates the legacy PascalCase.
 * Exported for unit testing.
 */
export function parseThamesRecord(raw: ThamesRecord): LocatedDischarge | null {
	const x = num(pick(raw, ['x', 'X']));
	const y = num(pick(raw, ['y', 'Y']));
	if (x === undefined || y === undefined) return null;
	const { lat, lon } = osgb36ToWgs84(x, y);

	const ongoing = isDischarging(str(pick(raw, ['alertStatus', 'AlertStatus'])));
	const startedAt =
		iso(pick(raw, ['mostRecentDischargeAlertStart', 'MostRecentDischargeAlertStart'])) ??
		iso(pick(raw, ['statusChanged', 'StatusChange', 'StatusChanged']));
	const endedAt = iso(pick(raw, ['mostRecentDischargeAlertStop', 'MostRecentDischargeAlertStop']));
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
		outfallName: str(pick(raw, ['locationName', 'LocationName'])) ?? 'Outfall',
		receivingWater: str(pick(raw, ['receivingWaterCourse', 'ReceivingWaterCourse']))
	};
}

let cache: { at: number; located: LocatedDischarge[] } | null = null;
let inflight: Promise<LocatedDischarge[]> | null = null;

async function loadThamesDischarges(signal?: AbortSignal): Promise<LocatedDischarge[]> {
	if (cache && Date.now() - cache.at < TTL_MS) return cache.located;
	if (inflight) return inflight;

	inflight = (async () => {
		try {
			const raw: ThamesRecord[] = [];
			let truncated = true;
			for (let page = 0; page < MAX_PAGES; page += 1) {
				const url = `${STATUS_ENDPOINT}?limit=${PAGE_SIZE}&offset=${page * PAGE_SIZE}`;
				const body = await fetchJson<unknown>(url, { signal });
				const items = Array.isArray(body)
					? (body as ThamesRecord[])
					: Array.isArray((body as { items?: unknown }).items)
						? (body as { items: ThamesRecord[] }).items
						: null;
				// A reshaped response (neither an array nor {items:[...]}) is an error,
				// not an empty result: throwing keeps the last good snapshot rather than
				// caching nothing and hiding real discharges.
				if (items === null) throw new Error('unexpected Thames Water response shape');
				raw.push(...items);
				if (items.length < PAGE_SIZE) {
					truncated = false;
					break;
				}
			}
			if (truncated) console.warn(`[thames] hit MAX_PAGES=${MAX_PAGES}, results may be truncated`);
			// No pre-filter: parseThamesRecord keeps only monitors with coordinates and
			// usable timing, and fetchThamesDischarges applies the authoritative 48h gate.
			const located = raw.map(parseThamesRecord).filter((d): d is LocatedDischarge => d !== null);
			cache = { at: Date.now(), located };
			return located;
		} catch (err) {
			console.warn(`[thames] discharge fetch failed: ${(err as Error).message}`);
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
			ongoing: d.ongoing,
			lat: d.lat,
			lon: d.lon
		});
	}
	events.sort((a, b) => a.distanceMetres - b.distanceMetres);
	return events;
}
