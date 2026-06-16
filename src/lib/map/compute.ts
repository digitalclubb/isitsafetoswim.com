import { getAllLocations } from '$lib/data/locations';
import type { Verdict } from '$lib/data/types';
import { fetchRecentDischarges } from '$lib/live/discharges';
import { fetchProfile } from '$lib/live/profile';
import { fetchRainfall24h } from '$lib/live/rainfall';
import { deriveVerdict } from '$lib/live/verdict';
import { mapPool } from './pool';
import { assembleColours } from './precompute';
import type { MapColours } from './types';

// Per-beach fetches in flight at once. Each beach makes up to three upstream
// requests, so this caps concurrent upstream load at roughly three times this.
const CONCURRENCY = 10;

export interface ComputeResult {
	blob: MapColours;
	computed: number;
	skipped: number;
	total: number;
}

/**
 * Compute today's verdict for every bathing water and fold the results into the
 * colour blob. Reuses the exact verdict derivation the per-location page uses
 * (deriveVerdict), fetching only the signals the verdict depends on: profile,
 * discharges and rainfall. History and sea temperature are deliberately skipped
 * since they do not affect the verdict and fetching them for every site would
 * blow third-party rate limits. A site we cannot reach is left out of the blob,
 * so the map shows it neutral rather than guessing a colour.
 */
export async function computeMapColours(now: Date, signal?: AbortSignal): Promise<ComputeResult> {
	const locations = getAllLocations();

	const verdicts = await mapPool(locations, CONCURRENCY, async (location) => {
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
	});

	const usable = verdicts.filter((v): v is { id: string; verdict: Verdict } => v !== null);
	return {
		blob: assembleColours(usable, now.toISOString()),
		computed: usable.length,
		skipped: locations.length - usable.length,
		total: locations.length
	};
}
