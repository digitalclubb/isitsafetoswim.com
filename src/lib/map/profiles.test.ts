import { describe, expect, it } from 'vitest';
import type { Location } from '$lib/data/types';
import type { ProfileFetchResult } from '$lib/live/profile';
import { mergeProfiles, type ProfileCache, selectStalest } from './profiles';

function loc(id: string): Location {
	return { id } as unknown as Location;
}

function profile(
	ok: boolean,
	classification: ProfileFetchResult['classification']
): ProfileFetchResult {
	return { ok, classification, latestSample: null, riskForecast: null, source: '' };
}

function cache(attemptedAt: Record<string, string>): ProfileCache {
	return { generatedAt: 't', profiles: {}, fetchedAt: {}, attemptedAt };
}

const locations = [loc('a'), loc('b'), loc('c'), loc('d')];

describe('selectStalest', () => {
	it('picks the least recently attempted, never-attempted first', () => {
		const c = cache({ a: '2026-06-16T10:00:00Z', c: '2026-06-16T08:00:00Z' });
		// b and d never attempted (stalest), then c (older), then a.
		expect(selectStalest(locations, c, 4).map((l) => l.id)).toEqual(['b', 'd', 'c', 'a']);
	});

	it('rotates so a failing batch does not starve the rest', () => {
		// a and b were just attempted (and may have failed); c and d never were.
		const c = cache({ a: '2026-06-16T12:00:00Z', b: '2026-06-16T12:00:00Z' });
		expect(selectStalest(locations, c, 2).map((l) => l.id)).toEqual(['c', 'd']);
	});

	it('limits the batch size', () => {
		expect(selectStalest(locations, null, 2)).toHaveLength(2);
	});
});

describe('mergeProfiles', () => {
	it('carries previous entries over and stamps successes', () => {
		const previous: ProfileCache = {
			generatedAt: 't0',
			profiles: { a: profile(true, 'Excellent') },
			fetchedAt: { a: 't0' },
			attemptedAt: { a: 't0' }
		};
		const { profiles, fetchedAt, attemptedAt, fetched } = mergeProfiles(
			[loc('b')],
			[profile(true, 'Good')],
			previous,
			'now'
		);
		expect(fetched).toBe(1);
		expect(profiles.a.classification).toBe('Excellent'); // carried over
		expect(profiles.b.classification).toBe('Good');
		expect(fetchedAt).toEqual({ a: 't0', b: 'now' });
		expect(attemptedAt.b).toBe('now');
	});

	it('on failure keeps the previous profile but still advances the attempt time', () => {
		const previous: ProfileCache = {
			generatedAt: 't0',
			profiles: { b: profile(true, 'Good') },
			fetchedAt: { b: 't0' },
			attemptedAt: { b: 't0' }
		};
		const { profiles, fetchedAt, attemptedAt, fetched } = mergeProfiles(
			[loc('b')],
			[profile(false, 'Sufficient')],
			previous,
			'now'
		);
		expect(fetched).toBe(0);
		expect(profiles.b.classification).toBe('Good'); // not the failed Sufficient
		expect(fetchedAt.b).toBe('t0'); // success time unchanged
		expect(attemptedAt.b).toBe('now'); // attempt advanced, so it rotates back
	});

	it('stores a fallback without a success time when nothing is cached yet', () => {
		const { profiles, fetchedAt, attemptedAt } = mergeProfiles(
			[loc('c')],
			[profile(false, 'Poor')],
			null,
			'now'
		);
		expect(profiles.c.ok).toBe(false);
		expect(fetchedAt.c).toBeUndefined();
		expect(attemptedAt.c).toBe('now'); // still rotates back
	});
});
