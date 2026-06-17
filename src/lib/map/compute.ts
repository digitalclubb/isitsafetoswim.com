import { getAllLocations } from '$lib/data/locations';
import type { DischargeEvent, Location, Verdict } from '$lib/data/types';
import { fetchRecentDischarges } from '$lib/live/discharges';
import type { ProfileFetchResult } from '$lib/live/profile';
import { fetchRainfallByLocation } from '$lib/live/rainfall';
import { deriveVerdict } from '$lib/live/verdict';
import { mapPool } from '$lib/util/pool';
import { readProfiles } from './kv';
import { assembleColours } from './precompute';
import type { ProfileCache } from './profiles';
import { aggregateSpills, type SpillSource } from './spills';
import type { MapColours, Spill } from './types';

// Per-beach fetches in flight at once. With profiles cached and rainfall
// batched, the only per-beach call is the discharge feed (ArcGIS, not the
// rate-limited host), so this can be a little higher.
const CONCURRENCY = 8;
const RETRY_PAUSE_MS = 3000;

type Computed = { id: string; verdict: Verdict; discharges: DischargeEvent[] } | null;

export interface ComputeResult {
	blob: MapColours;
	spills: Spill[];
	computed: number;
	skipped: number;
	total: number;
}

// The cached profile when we have one, otherwise a classification-only fallback
// flagged ok so the beach is still given a verdict (the same treatment Scotland
// and NI get). This keeps map coverage complete even before the daily profile
// cron has run.
function profileFor(location: Location, cache: ProfileCache | null): ProfileFetchResult {
	const cached = cache?.profiles[location.id];
	if (cached?.ok) return cached;
	return {
		ok: true,
		classification: location.classification === 'Unknown' ? null : location.classification,
		latestSample: null,
		riskForecast: null,
		source: ''
	};
}

async function computeOne(
	location: Location,
	profile: ProfileFetchResult,
	rainfall24hMm: number | null,
	now: Date,
	signal?: AbortSignal
): Promise<Computed> {
	try {
		const recentDischarges = await fetchRecentDischarges(location, signal).catch(() => []);
		const verdict = deriveVerdict(location, profile, recentDischarges, rainfall24hMm, now);
		if (verdict.dataAge === 'unavailable') return null;
		return { id: location.id, verdict: verdict.verdict, discharges: recentDischarges };
	} catch {
		return null;
	}
}

/**
 * Compute today's verdict for every bathing water and fold the results into the
 * colour blob. Reuses the exact verdict derivation the per-location page uses
 * (deriveVerdict). Profiles come from the daily cache and rainfall from a single
 * batch, so the hourly run barely touches the rate-limited host: the only
 * per-beach request is the discharge feed.
 *
 * Sites that fail the first pass get one more attempt after a short pause.
 */
export async function computeMapColours(now: Date, signal?: AbortSignal): Promise<ComputeResult> {
	const locations = getAllLocations();
	const [rainfall, profileCache] = await Promise.all([
		fetchRainfallByLocation(locations, signal),
		readProfiles()
	]);

	const run = (location: Location) =>
		computeOne(
			location,
			profileFor(location, profileCache),
			rainfall.get(location.id) ?? null,
			now,
			signal
		);

	const results = await mapPool(locations, CONCURRENCY, run);

	const failedIndexes = results.flatMap((r, i) => (r === null ? [i] : []));
	if (failedIndexes.length > 0) {
		await new Promise((resolve) => setTimeout(resolve, RETRY_PAUSE_MS));
		const retried = await mapPool(failedIndexes, CONCURRENCY, (i) => run(locations[i]));
		failedIndexes.forEach((index, k) => {
			results[index] = retried[k];
		});
	}

	const usable = results.filter((v): v is NonNullable<Computed> => v !== null);

	// Reuse the discharges already fetched to build the national spills list:
	// each was found within range of its beach, so it is "near a bathing water"
	// by construction.
	const sources: SpillSource[] = [];
	results.forEach((result, i) => {
		if (result && result.discharges.length > 0) {
			const loc = locations[i];
			sources.push({
				slug: loc.slug,
				name: loc.name,
				region: loc.region,
				country: loc.country,
				lat: loc.lat,
				lon: loc.lon,
				company: loc.sewerageUndertaker,
				discharges: result.discharges
			});
		}
	});

	return {
		blob: assembleColours(usable, now.toISOString()),
		spills: aggregateSpills(sources),
		computed: usable.length,
		skipped: locations.length - usable.length,
		total: locations.length
	};
}
