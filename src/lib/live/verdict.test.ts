import { describe, expect, it, vi } from 'vitest';
import type { Location } from '$lib/data/types';
import type { ProfileFetchResult } from './profile';
import { buildPageData, type CachedSignals, pickProfile } from './verdict';

function profile(ok: boolean, source: string): ProfileFetchResult {
	return { ok, classification: 'Good', latestSample: null, riskForecast: null, source };
}

vi.mock('./profile', () => ({
	fetchProfile: async () => ({
		ok: true,
		classification: 'Good',
		latestSample: null,
		riskForecast: null,
		source: 'live'
	})
}));

vi.mock('./discharges', () => ({
	fetchRecentDischarges: async () => [],
	hasDischargeFeed: () => true,
	isThamesWater: () => false
}));

const BRIGHTON: Location = {
	id: 'ea-test',
	slug: 'test',
	name: 'Test',
	country: 'England',
	lat: 50.82,
	lon: -0.145,
	classification: 'Good',
	waterType: 'coastal',
	rainImpacted: true,
	source: { api: 'ea', sourceId: 'test' }
};

describe('buildPageData', () => {
	it('uses the rainfall total the cache resolved', async () => {
		const cached: CachedSignals = { profile: null, rainfall24hMm: 21 };
		const data = await buildPageData(BRIGHTON, Promise.resolve(cached));
		expect(data.rainfall24hMm).toBe(21);
	});

	// The cache read is wrapped so it cannot reject, but the page must still
	// render its verdict if that ever changes: rainfall simply drops to no signal.
	it('still assembles a verdict when the cache read rejects', async () => {
		const data = await buildPageData(BRIGHTON, Promise.reject(new Error('redis down')));
		expect(data.rainfall24hMm).toBeNull();
		expect(data.verdict.dataAge).toBe('fresh');
		expect(data.verdict.verdict).toBe('yes');
	});
});

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
