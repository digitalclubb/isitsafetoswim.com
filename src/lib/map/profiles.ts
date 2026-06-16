import { getAllLocations } from '$lib/data/locations';
import type { Location } from '$lib/data/types';
import { fetchProfile, type ProfileFetchResult } from '$lib/live/profile';
import { mapPool } from '$lib/util/pool';

export interface ProfileCache {
	generatedAt: string;
	profiles: Record<string, ProfileFetchResult>;
}

// Profiles are fetched gently: the host (environment.data.gov.uk) rate-limits a
// burst, and this runs daily with the whole day to spare, so a low concurrency
// plus one retry pass stays well under the limit.
const CONCURRENCY = 4;
const RETRY_PAUSE_MS = 3000;

/**
 * Fold freshly fetched profiles into the cache. A successful fetch wins; a
 * failure keeps the previously cached profile so a throttled run never loses a
 * forecast we already had, and only falls back to the (classification-only)
 * failed result when there is nothing better. Pure, so it is unit-tested.
 */
export function mergeProfiles(
	locations: readonly Location[],
	results: ReadonlyArray<ProfileFetchResult | null>,
	previous: ProfileCache | null
): { profiles: Record<string, ProfileFetchResult>; fetched: number } {
	const profiles: Record<string, ProfileFetchResult> = {};
	let fetched = 0;
	locations.forEach((location, i) => {
		const fresh = results[i];
		if (fresh?.ok) {
			profiles[location.id] = fresh;
			fetched += 1;
			return;
		}
		const prev = previous?.profiles[location.id];
		if (prev) profiles[location.id] = prev;
		else if (fresh) profiles[location.id] = fresh;
	});
	return { profiles, fetched };
}

export interface ProfileRefreshResult {
	cache: ProfileCache;
	fetched: number;
	total: number;
}

export async function computeProfileCache(
	now: Date,
	previous: ProfileCache | null,
	signal?: AbortSignal
): Promise<ProfileRefreshResult> {
	const locations = getAllLocations();
	const fetchOne = async (location: Location): Promise<ProfileFetchResult | null> => {
		try {
			return await fetchProfile(location, signal);
		} catch {
			return null;
		}
	};

	const results = await mapPool(locations, CONCURRENCY, fetchOne);

	const failed = locations.flatMap((_, i) => (results[i]?.ok ? [] : [i]));
	if (failed.length > 0) {
		await new Promise((resolve) => setTimeout(resolve, RETRY_PAUSE_MS));
		const retried = await mapPool(failed, CONCURRENCY, (i) => fetchOne(locations[i]));
		failed.forEach((index, k) => {
			results[index] = retried[k];
		});
	}

	const { profiles, fetched } = mergeProfiles(locations, results, previous);
	return {
		cache: { generatedAt: now.toISOString(), profiles },
		fetched,
		total: locations.length
	};
}
