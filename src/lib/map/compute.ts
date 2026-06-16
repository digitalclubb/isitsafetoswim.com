import { getAllLocations } from '$lib/data/locations';
import type { Location, Verdict } from '$lib/data/types';
import { fetchRecentDischarges } from '$lib/live/discharges';
import { fetchProfile } from '$lib/live/profile';
import { fetchRainfallByLocation } from '$lib/live/rainfall';
import { deriveVerdict } from '$lib/live/verdict';
import { mapPool } from '$lib/util/pool';
import { assembleColours } from './precompute';
import type { MapColours } from './types';

// Per-beach fetches in flight at once. With rainfall now batched, each beach
// makes only a profile and a discharge request, and the profile host
// (environment.data.gov.uk) is the one that rate-limits, so this stays low.
const CONCURRENCY = 6;

// Pause before the retry pass to let a tripped rate limit reset.
const RETRY_PAUSE_MS = 3000;

type Computed = { id: string; verdict: Verdict } | null;

export interface ComputeResult {
	blob: MapColours;
	computed: number;
	skipped: number;
	total: number;
}

async function computeOne(
	location: Location,
	rainfall24hMm: number | null,
	now: Date,
	signal?: AbortSignal
): Promise<Computed> {
	try {
		const [profileR, dischargesR] = await Promise.allSettled([
			fetchProfile(location, signal),
			fetchRecentDischarges(location, signal)
		]);
		const profile = profileR.status === 'fulfilled' ? profileR.value : null;
		const recentDischarges = dischargesR.status === 'fulfilled' ? dischargesR.value : [];
		const verdict = deriveVerdict(location, profile, recentDischarges, rainfall24hMm, now);
		// 'unavailable' means every source failed for this site, so we have no
		// colour. A kept beach may still be on its cached classification (same
		// fallback the live page uses), so the count is a freshness floor, not
		// a freshness guarantee, which is why the cron guards on it.
		if (verdict.dataAge === 'unavailable') return null;
		return { id: location.id, verdict: verdict.verdict };
	} catch {
		return null;
	}
}

/**
 * Compute today's verdict for every bathing water and fold the results into the
 * colour blob. Reuses the exact verdict derivation the per-location page uses
 * (deriveVerdict), fetching only the signals the verdict depends on: profile,
 * discharges and rainfall. Rainfall is fetched in a single batch up front so the
 * flood-monitoring host is hit a handful of times rather than twice per beach.
 * History and sea temperature are skipped since they do not affect the verdict.
 *
 * Sites that fail the first pass (usually transient regulator throttling) get
 * one more attempt after a short pause. A site we still cannot reach is left out
 * of the blob, so the map shows it neutral rather than guessing a colour.
 */
export async function computeMapColours(now: Date, signal?: AbortSignal): Promise<ComputeResult> {
	const locations = getAllLocations();
	const rainfall = await fetchRainfallByLocation(locations, signal);

	const run = (location: Location) =>
		computeOne(location, rainfall.get(location.id) ?? null, now, signal);

	const results = await mapPool(locations, CONCURRENCY, run);

	const failedIndexes = results.flatMap((r, i) => (r === null ? [i] : []));
	if (failedIndexes.length > 0) {
		await new Promise((resolve) => setTimeout(resolve, RETRY_PAUSE_MS));
		const retried = await mapPool(failedIndexes, CONCURRENCY, (i) => run(locations[i]));
		failedIndexes.forEach((index, k) => {
			results[index] = retried[k];
		});
	}

	const usable = results.filter((v): v is { id: string; verdict: Verdict } => v !== null);
	return {
		blob: assembleColours(usable, now.toISOString()),
		computed: usable.length,
		skipped: locations.length - usable.length,
		total: locations.length
	};
}
