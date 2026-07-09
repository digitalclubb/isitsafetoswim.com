import { describe, expect, it } from 'vitest';
import type { ProfileFetchResult } from './profile';
import { pickProfile } from './verdict';

function profile(ok: boolean, source: string): ProfileFetchResult {
	return { ok, classification: 'Good', latestSample: null, riskForecast: null, source };
}

describe('pickProfile', () => {
	it('prefers the live profile when the live fetch succeeded', () => {
		const live = profile(true, 'live');
		const cached = profile(true, 'cache');
		expect(pickProfile(live, cached)?.source).toBe('live');
	});

	it('falls back to the cached profile when the live fetch failed', () => {
		const live = profile(false, 'live');
		const cached = profile(true, 'cache');
		expect(pickProfile(live, cached)?.source).toBe('cache');
	});

	it('falls back to the cached profile when the live fetch threw', () => {
		const cached = profile(true, 'cache');
		expect(pickProfile(null, cached)?.source).toBe('cache');
	});

	it('keeps the failed live result when there is no usable cache', () => {
		const live = profile(false, 'live');
		expect(pickProfile(live, profile(false, 'cache'))?.source).toBe('live');
	});

	it('returns null when neither source is usable', () => {
		expect(pickProfile(null, null)).toBeNull();
	});
});
