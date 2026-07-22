import { describe, expect, it } from 'vitest';
import {
	assembleColours,
	assembleRainfall,
	hasUsableCoverage,
	RAINFALL_MAX_AGE_MS,
	rainfallFrom
} from './precompute';

describe('rainfallFrom', () => {
	const now = new Date('2026-06-16T12:00:00.000Z');
	const blob = (minutesAgo: number) => ({
		generatedAt: new Date(now.getTime() - minutesAgo * 60_000).toISOString(),
		rainfall: { a: 12.4, b: 0 }
	});

	it('reads the total for a location from a fresh blob', () => {
		expect(rainfallFrom(blob(30), 'a', now)).toBe(12.4);
	});

	it('keeps a genuine zero rather than reading it as no signal', () => {
		expect(rainfallFrom(blob(30), 'b', now)).toBe(0);
	});

	it('returns null for a location the blob does not cover', () => {
		expect(rainfallFrom(blob(30), 'missing', now)).toBeNull();
	});

	it('returns null when there is no blob', () => {
		expect(rainfallFrom(null, 'a', now)).toBeNull();
	});

	it('discards a blob older than the maximum age so a dead cron cannot lie', () => {
		expect(rainfallFrom(blob(RAINFALL_MAX_AGE_MS / 60_000 + 1), 'a', now)).toBeNull();
	});

	it('keeps a blob right on the maximum age', () => {
		expect(rainfallFrom(blob(RAINFALL_MAX_AGE_MS / 60_000), 'a', now)).toBe(12.4);
	});

	it('discards a blob with an unparseable timestamp', () => {
		expect(rainfallFrom({ generatedAt: 'never', rainfall: { a: 12.4 } }, 'a', now)).toBeNull();
	});
});

describe('hasUsableCoverage', () => {
	const blob = (count: number) => ({
		generatedAt: 't',
		rainfall: Object.fromEntries(Array.from({ length: count }, (_, i) => [`id-${i}`, 1]))
	});

	it('accepts a healthy run, England being the only country with stations', () => {
		expect(hasUsableCoverage(blob(463), 701)).toBe(true);
	});

	it('rejects a batch that lost most of its stations', () => {
		expect(hasUsableCoverage(blob(40), 701)).toBe(false);
	});

	it('rejects an empty batch', () => {
		expect(hasUsableCoverage(blob(0), 701)).toBe(false);
	});
});

describe('assembleRainfall', () => {
	it('keeps the totals it has and stamps the run time', () => {
		const blob = assembleRainfall(
			new Map([
				['a', 12.4],
				['b', 0]
			]),
			'2026-06-16T09:00:00.000Z'
		);
		expect(blob).toEqual({
			generatedAt: '2026-06-16T09:00:00.000Z',
			rainfall: { a: 12.4, b: 0 }
		});
	});

	it('drops locations with no reading rather than storing null', () => {
		const blob = assembleRainfall(
			new Map([
				['a', 3],
				['b', null]
			]),
			't'
		);
		expect(blob.rainfall).toEqual({ a: 3 });
	});

	it('produces an empty map for no input', () => {
		expect(assembleRainfall(new Map(), 't').rainfall).toEqual({});
	});
});

describe('assembleColours', () => {
	it('builds an id to verdict map with the timestamp', () => {
		const blob = assembleColours(
			[
				{ id: 'a', verdict: 'yes' },
				{ id: 'b', verdict: 'no' }
			],
			'2026-06-16T09:00:00.000Z'
		);
		expect(blob).toEqual({
			generatedAt: '2026-06-16T09:00:00.000Z',
			colours: { a: 'yes', b: 'no' }
		});
	});

	it('keeps the last verdict on a duplicate id', () => {
		const blob = assembleColours(
			[
				{ id: 'a', verdict: 'yes' },
				{ id: 'a', verdict: 'no' }
			],
			't'
		);
		expect(blob.colours.a).toBe('no');
	});

	it('produces an empty colour map for no input', () => {
		expect(assembleColours([], 't')).toEqual({ generatedAt: 't', colours: {} });
	});
});
