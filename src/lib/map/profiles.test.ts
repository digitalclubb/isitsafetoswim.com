import { describe, expect, it } from 'vitest';
import type { Location } from '$lib/data/types';
import type { ProfileFetchResult } from '$lib/live/profile';
import { mergeProfiles, type ProfileCache } from './profiles';

function loc(id: string): Location {
	return { id } as unknown as Location;
}

function profile(
	ok: boolean,
	classification: ProfileFetchResult['classification']
): ProfileFetchResult {
	return { ok, classification, latestSample: null, riskForecast: null, source: '' };
}

describe('mergeProfiles', () => {
	const locations = [loc('a'), loc('b'), loc('c')];

	it('takes a successful fetch and counts it', () => {
		const results = [profile(true, 'Excellent'), profile(true, 'Good'), profile(true, 'Poor')];
		const { profiles, fetched } = mergeProfiles(locations, results, null);
		expect(fetched).toBe(3);
		expect(profiles.a.classification).toBe('Excellent');
	});

	it('keeps the previous profile when a fetch fails', () => {
		const previous: ProfileCache = {
			generatedAt: 't',
			profiles: { b: profile(true, 'Good') }
		};
		const results = [profile(true, 'Excellent'), profile(false, 'Sufficient'), null];
		const { profiles, fetched } = mergeProfiles(locations, results, previous);
		expect(fetched).toBe(1); // only a succeeded
		expect(profiles.a.classification).toBe('Excellent');
		expect(profiles.b.classification).toBe('Good'); // kept from previous, not the failed Sufficient
		expect(profiles.c).toBeUndefined(); // failed, no previous, no result
	});

	it('stores a failed fallback when there is no previous to keep', () => {
		const results = [profile(false, 'Sufficient'), null, null];
		const { profiles, fetched } = mergeProfiles(locations, results, null);
		expect(fetched).toBe(0);
		expect(profiles.a.ok).toBe(false);
		expect(profiles.a.classification).toBe('Sufficient');
	});
});
