import type { Location, RiskForecast } from '$lib/data/types';
import { fetchJson } from './http';

/**
 * DAERA's daily pollution-risk prediction. Northern Ireland was documented here
 * as publishing no forecast at all; it publishes one, on a separate ArcGIS
 * layer from the monitoring points the catalogue is built from, for the six
 * sites currently inside its predictive-modelling programme.
 *
 * Each row carries the day it applies to (`pm_current_prediction_for`, set to
 * local midnight), so freshness is decided by the date the regulator stamped on
 * the prediction rather than by when we happened to read it. That is a stronger
 * test than an age window: yesterday's prediction is never today's answer, no
 * matter how recently the layer was edited.
 */
const PREDICTION_LAYER =
	'https://services-eu1.arcgis.com/kswen6BYexuc1SUk/arcgis/rest/services/Bathing_Waters_Predictive_Modelling_view/FeatureServer/0/query';

interface PredictionAttributes {
	Bathing_Water_Site?: unknown;
	Unique_Site_ID_Code?: unknown;
	pm_in_scope?: unknown;
	pm_current_prediction?: unknown;
	pm_current_prediction_for?: unknown;
	pm_publish_override?: unknown;
}

interface PredictionResponse {
	features?: Array<{ attributes?: PredictionAttributes }>;
}

/** The London calendar date of an instant, which is what the day stamp means. */
function londonDay(ms: number): string {
	return new Intl.DateTimeFormat('en-CA', {
		timeZone: 'Europe/London',
		year: 'numeric',
		month: '2-digit',
		day: '2-digit'
	}).format(new Date(ms));
}

function toRiskLevel(prediction: string): RiskForecast['riskLevel'] | null {
	const lower = prediction.toLowerCase();
	// "Increased Risk" is the alerting value; anything explicitly normal is the
	// all-clear. An unrecognised word returns null rather than being guessed at.
	if (lower.includes('increase') || lower.includes('high') || lower.includes('poor')) {
		return 'increased';
	}
	if (lower.includes('normal') || lower.includes('low')) return 'normal';
	return null;
}

/**
 * Parse the prediction layer into a site-id-keyed map, keeping only rows that
 * are in scope, published, readable and stamped for today. Pure, so the day
 * test is unit-testable without the network.
 */
export function parseDaeraPredictions(
	body: PredictionResponse,
	now: Date
): Map<string, RiskForecast> {
	const today = londonDay(now.getTime());
	const out = new Map<string, RiskForecast>();
	for (const feature of body.features ?? []) {
		const attrs = feature.attributes ?? {};
		const id = attrs.Unique_Site_ID_Code;
		if (id === undefined || id === null) continue;
		if (String(attrs.pm_in_scope ?? '').toLowerCase() !== 'yes') continue;
		// DAERA sets this when it is deliberately withholding the modelled value.
		if (String(attrs.pm_publish_override ?? 'No').toLowerCase() === 'yes') continue;
		const prediction =
			typeof attrs.pm_current_prediction === 'string' ? attrs.pm_current_prediction : '';
		if (!prediction) continue;
		// ArcGIS returns epoch milliseconds today. Accepting a date string too
		// means a change of representation degrades to a parse rather than
		// silently blanking the forecast for all six sites.
		const raw = attrs.pm_current_prediction_for;
		const stampedFor = typeof raw === 'string' ? Date.parse(raw) : Number(raw);
		if (!Number.isFinite(stampedFor) || stampedFor <= 0) continue;
		if (londonDay(stampedFor) !== today) continue;
		const riskLevel = toRiskLevel(prediction);
		if (!riskLevel) continue;
		out.set(String(id), { riskLevel });
	}
	return out;
}

/**
 * One unfiltered query covers all of Northern Ireland, so the result is shared
 * across sites rather than fetched per beach. Same shape as the SEPA and Thames
 * loaders: a short TTL, and `inflight` collapsing concurrent renders.
 */
const TTL_MS = 10 * 60 * 1000;
let cache: { at: number; body: PredictionResponse } | null = null;
let inflight: Promise<PredictionResponse> | null = null;

async function loadPredictions(signal?: AbortSignal): Promise<PredictionResponse> {
	if (cache && Date.now() - cache.at < TTL_MS) return cache.body;
	if (inflight) return inflight;

	const url = `${PREDICTION_LAYER}?where=${encodeURIComponent('1=1')}&outFields=Unique_Site_ID_Code,pm_in_scope,pm_current_prediction,pm_current_prediction_for,pm_publish_override&returnGeometry=false&f=json`;
	inflight = fetchJson<PredictionResponse>(url, { signal })
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
 * Today's DAERA prediction for one site, or null when the site is outside the
 * programme, the prediction is not for today, or the fetch fails.
 */
export async function fetchDaeraForecast(
	location: Location,
	signal?: AbortSignal,
	now: Date = new Date()
): Promise<RiskForecast | null> {
	if (location.source.api !== 'daera') return null;
	let body: PredictionResponse;
	try {
		body = await loadPredictions(signal);
	} catch {
		return null;
	}
	return parseDaeraPredictions(body, now).get(location.source.sourceId) ?? null;
}
