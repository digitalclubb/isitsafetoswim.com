import { getAllLocations } from '$lib/data/locations';
import type { Location, Verdict } from '$lib/data/types';
import { fetchRecentDischarges } from '$lib/live/discharges';
import { fetchProfile } from '$lib/live/profile';
import { fetchRainfall24h } from '$lib/live/rainfall';
import { deriveVerdict } from '$lib/live/verdict';
import { mapPool } from './pool';
import { assembleColours } from './precompute';
import type { MapColours } from './types';

// Per-beach fetches in flight at once. Kept low because most sites' profile and
// rainfall calls hit the same host (environment.data.gov.uk), which rate-limits
// a burst of ~700. Each beach makes up to three upstream requests, so concurrent
// load on that host is roughly twice this.
const CONCURRENCY = 4;

// Pause before the retry pass to let a tripped rate limit reset.
const RETRY_PAUSE_MS = 3000;

type Computed = { id: string; verdict: Verdict } | null;

export interface ComputeResult {
	blob: MapColours;
	computed: number;
	skipped: number;
	total: number;
}

async function computeOne(location: Location, now: Date, signal?: AbortSignal): Promise<Computed> {
	try {
		const [profileR, dischargesR, rainfallR] = await Promise.allSettled([
			fetchProfile(location, signal),
			fetchRecentDischarges(location, signal),
			fetchRainfall24h({ lat: location.lat, lon: location.lon }, signal)
		]);
		const profile = profileR.status === 'fulfilled' ? profileR.value : null;
		const recentDischarges = dischargesR.status === 'fulfilled' ? dischargesR.value : [];
		const rainfall24hMm = rainfallR.status === 'fulfilled' ? rainfallR.value : null;
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
 * discharges and rainfall. History and sea temperature are deliberately skipped
 * since they do not affect the verdict and fetching them for every site would
 * blow third-party rate limits.
 *
 * Sites that fail the first pass (usually transient regulator throttling) get
 * one more attempt after a short pause. A site we still cannot reach is left out
 * of the blob, so the map shows it neutral rather than guessing a colour.
 */
export async function computeMapColours(now: Date, signal?: AbortSignal): Promise<ComputeResult> {
	const locations = getAllLocations();

	const results = await mapPool(locations, CONCURRENCY, (location) =>
		computeOne(location, now, signal)
	);

	const failedIndexes = results.flatMap((r, i) => (r === null ? [i] : []));
	if (failedIndexes.length > 0) {
		await new Promise((resolve) => setTimeout(resolve, RETRY_PAUSE_MS));
		const retried = await mapPool(failedIndexes, CONCURRENCY, (i) =>
			computeOne(locations[i], now, signal)
		);
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
