import { getAllLocations } from '$lib/data/locations';
import type { Location } from '$lib/data/types';
import { fetchProfile, type ProfileFetchResult } from '$lib/live/profile';
import { pacedMap } from '$lib/util/pool';

export interface ProfileCache {
	generatedAt: string;
	profiles: Record<string, ProfileFetchResult>;
	// id -> ISO time the profile was last successfully fetched. Tracks forecast
	// freshness and how many beaches have live data; not used for selection.
	fetchedAt: Record<string, string>;
	// id -> ISO time we last attempted a fetch (success or failure). Drives
	// selection so every beach rotates through, even a block that fails every
	// run, rather than the same failing batch being retried forever.
	attemptedAt: Record<string, string>;
}

// The host (environment.data.gov.uk) rate-limits hard, so one run cannot fetch
// all ~600 profiles. Each run refreshes the stalest BATCH_SIZE, paced to one
// every PACE_MS, and the hourly schedule cycles through the whole catalogue
// within a few hours. Profiles change at most daily, so this stays fresh.
const BATCH_SIZE = 120;
const PACE_MS = 1500;

/**
 * The beaches least recently attempted, limited to `limit`. Selecting on
 * attempt time (not success time) means a beach that keeps failing rotates to
 * the back after its turn instead of blocking the queue forever, so a large
 * persistent failure can never starve the healthy beaches. Pure, so it is
 * unit-tested. ISO timestamps sort chronologically as strings, a missing one
 * sorts first, and ties resolve to catalogue order via the stable sort.
 */
export function selectStalest(
	locations: readonly Location[],
	cache: ProfileCache | null,
	limit: number
): Location[] {
	const attemptedAt = cache?.attemptedAt ?? {};
	return [...locations]
		.sort((a, b) => (attemptedAt[a.id] ?? '').localeCompare(attemptedAt[b.id] ?? ''))
		.slice(0, limit);
}

/**
 * Fold a freshly fetched batch into the full cache. Everything not in the batch
 * carries over from `previous`. A successful fetch updates the profile and
 * stamps its time; a failure keeps the previously cached profile (so a forecast
 * we already had is never lost) and leaves its timestamp stale so it is retried
 * first next run. A failure with nothing cached stores the classification-only
 * fallback but no timestamp, so it stays stalest. Pure, so it is unit-tested.
 */
export function mergeProfiles(
	batch: readonly Location[],
	results: ReadonlyArray<ProfileFetchResult | null>,
	previous: ProfileCache | null,
	now: string
): {
	profiles: Record<string, ProfileFetchResult>;
	fetchedAt: Record<string, string>;
	attemptedAt: Record<string, string>;
	fetched: number;
} {
	const profiles: Record<string, ProfileFetchResult> = { ...(previous?.profiles ?? {}) };
	const fetchedAt: Record<string, string> = { ...(previous?.fetchedAt ?? {}) };
	const attemptedAt: Record<string, string> = { ...(previous?.attemptedAt ?? {}) };
	let fetched = 0;
	batch.forEach((location, i) => {
		// Every batch member counts as attempted, so it rotates to the back even
		// when the fetch fails.
		attemptedAt[location.id] = now;
		const fresh = results[i];
		if (fresh?.ok) {
			profiles[location.id] = fresh;
			fetchedAt[location.id] = now;
			fetched += 1;
		} else if (fresh && !profiles[location.id]) {
			profiles[location.id] = fresh;
		}
	});
	return { profiles, fetchedAt, attemptedAt, fetched };
}

export interface ProfileRefreshResult {
	cache: ProfileCache;
	batch: number;
	fetched: number;
	liveFetched: number;
	cached: number;
	total: number;
}

export async function computeProfileCache(
	now: Date,
	previous: ProfileCache | null,
	signal?: AbortSignal
): Promise<ProfileRefreshResult> {
	const locations = getAllLocations();
	const batch = selectStalest(locations, previous, BATCH_SIZE);

	const results = await pacedMap(batch, PACE_MS, async (location) => {
		try {
			return await fetchProfile(location, signal);
		} catch {
			return null;
		}
	});

	const { profiles, fetchedAt, attemptedAt, fetched } = mergeProfiles(
		batch,
		results,
		previous,
		now.toISOString()
	);
	return {
		cache: { generatedAt: now.toISOString(), profiles, fetchedAt, attemptedAt },
		batch: batch.length,
		fetched,
		liveFetched: Object.keys(fetchedAt).length,
		cached: Object.keys(profiles).length,
		total: locations.length
	};
}
