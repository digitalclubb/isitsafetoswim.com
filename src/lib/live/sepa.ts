import type { Location, RiskForecast } from '$lib/data/types';
import { fetchJson } from './http';

/**
 * SEPA's daily bathing-water prediction, published by 10:00 from 1 June to
 * 15 September for the subset of Scottish sites carrying an electronic sign.
 * It rides on layer 18 of the same MapServer the catalogue is built from, so
 * no new host is involved.
 *
 * The forecast is a plain "Good" or "Poor" call on today's water quality,
 * which maps onto the same normal/increased risk levels the EA publishes, so
 * Scotland feeds the verdict engine through the identical `RiskForecast`
 * shape rather than a parallel branch.
 */
const SIGNAGE_LAYER =
	'https://map.sepa.org.uk/server/rest/services/Open/Environmental_Monitoring/MapServer/18/query';

/**
 * How old a prediction may be and still count as today's. SEPA posts by 10:00
 * daily in season, so a shade over one publication cycle allows for a late run
 * without ever letting yesterday's call stand in for today's.
 *
 * This gate is load-bearing rather than defensive. As of September 2026 every
 * row in the layer still carries a `last_updated` of 19 May, four months stale,
 * even though SEPA's own site updates daily. Serving those values as today's
 * forecast would put a months-old "Poor" on the page, so a stale layer must
 * read as no forecast at all. Nothing renders from this feed until SEPA
 * resumes updating the open-data mirror, which is the correct outcome.
 */
const MAX_AGE_MS = 26 * 60 * 60 * 1000;

interface SignageAttributes {
	description?: unknown;
	current_forecast?: unknown;
	last_updated?: unknown;
}

interface SignageResponse {
	features?: Array<{ attributes?: SignageAttributes }>;
}

/** SEPA writes the site name identically in both layers, so it is the join key. */
function normaliseName(name: string): string {
	return name.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function toRiskLevel(forecast: string): RiskForecast['riskLevel'] | null {
	const lower = forecast.toLowerCase();
	if (lower.includes('poor')) return 'increased';
	if (lower.includes('good') || lower.includes('excellent')) return 'normal';
	return null;
}

/**
 * Parse the signage layer into a name-keyed forecast map, dropping any row
 * that is stale, unparseable or carries no prediction. Pure, so the freshness
 * gate is testable without the network.
 */
export function parseSepaForecasts(body: SignageResponse, now: Date): Map<string, RiskForecast> {
	const out = new Map<string, RiskForecast>();
	for (const feature of body.features ?? []) {
		const attrs = feature.attributes ?? {};
		const name = typeof attrs.description === 'string' ? attrs.description.trim() : '';
		const forecast = typeof attrs.current_forecast === 'string' ? attrs.current_forecast : '';
		const updated = Number(attrs.last_updated);
		if (!name || !forecast) continue;
		if (!Number.isFinite(updated) || updated <= 0) continue;
		const age = now.getTime() - updated;
		// A future timestamp is as much a sign of a broken feed as an ancient one.
		if (age < 0 || age > MAX_AGE_MS) continue;
		const riskLevel = toRiskLevel(forecast);
		if (!riskLevel) continue;
		out.set(normaliseName(name), {
			riskLevel,
			expiresAt: new Date(updated + MAX_AGE_MS).toISOString()
		});
	}
	return out;
}

/**
 * One unfiltered query returns the whole layer, so the result is shared across
 * every Scottish site rather than fetched per beach. Without this the hourly
 * profile cron, which batches straight from the full catalogue, would make ~90
 * identical whole-layer requests an hour where it previously made none.
 *
 * The prediction changes once a day, so a short TTL is generous. `inflight`
 * collapses a burst of concurrent renders into a single request. Same shape as
 * the Thames Water loader.
 */
const TTL_MS = 10 * 60 * 1000;
let cache: { at: number; body: SignageResponse } | null = null;
let inflight: Promise<SignageResponse> | null = null;

async function loadSignageLayer(signal?: AbortSignal): Promise<SignageResponse> {
	if (cache && Date.now() - cache.at < TTL_MS) return cache.body;
	if (inflight) return inflight;

	const url = `${SIGNAGE_LAYER}?where=${encodeURIComponent('1=1')}&outFields=description,current_forecast,last_updated&returnGeometry=false&f=json`;
	inflight = fetchJson<SignageResponse>(url, { signal })
		.then((body) => {
			cache = { at: Date.now(), body };
			return body;
		})
		.finally(() => {
			inflight = null;
		});
	return inflight;
}

/**
 * Today's SEPA prediction for one site, or null when the site has no sign, the
 * layer is stale or the fetch fails.
 */
export async function fetchSepaForecast(
	location: Location,
	signal?: AbortSignal,
	now: Date = new Date()
): Promise<RiskForecast | null> {
	if (location.source.api !== 'sepa') return null;
	let body: SignageResponse;
	try {
		body = await loadSignageLayer(signal);
	} catch {
		return null;
	}
	const forecasts = parseSepaForecasts(body, now);
	// The catalogue may carry a display-name override, so try the regulator's
	// own name first and fall back to the displayed one.
	return (
		forecasts.get(normaliseName(location.officialName ?? location.name)) ??
		forecasts.get(normaliseName(location.name)) ??
		null
	);
}
