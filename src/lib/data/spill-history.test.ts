import { describe, expect, it } from 'vitest';
import {
	comparableSpillYears,
	getSpillHistory,
	getSpillHistoryMeta,
	latestSpillYear,
	type SpillYear,
	spillTrend
} from './spill-history';

const years = (...pairs: Array<[number, number]>): SpillYear[] =>
	pairs.map(([year, spills]) => ({ year, overflows: 1, spills }));

describe('getSpillHistory', () => {
	it('returns null for a bathing water with no record', () => {
		expect(getSpillHistory('not-a-real-slug')).toBeNull();
	});

	// The EDM return is an England publication, so the other three countries
	// carry no record at all and the page must not imply otherwise.
	it('returns null for a Welsh site', () => {
		expect(getSpillHistory('whitmore-bay-barry-island')).toBeNull();
	});

	it('returns a record for an English site', () => {
		const record = getSpillHistory('eastbourne');
		expect(record).not.toBeNull();
		expect(record?.nearby.length).toBeGreaterThan(0);
	});

	// The two figures measure different things, and neither bounds the other.
	// St Annes carries 64 attributed overflows against 19 within 10km, because
	// attribution follows the sewer network upstream and a radius cannot. That
	// is the whole reason the attributed figure is the one the page leads with,
	// so it is worth pinning rather than assuming the radius always wins.
	it('lets attributed overflows outnumber nearby ones where the network runs inland', () => {
		const record = getSpillHistory('st-annes');
		const attributed = record?.attributed.at(-1);
		const nearby = record?.nearby.at(-1);
		expect(attributed?.overflows).toBeGreaterThan(nearby?.overflows ?? 0);
	});

	it('keeps every year within the range the file declares', () => {
		const { years: declared } = getSpillHistoryMeta();
		const record = getSpillHistory('eastbourne');
		for (const entry of [...(record?.attributed ?? []), ...(record?.nearby ?? [])]) {
			expect(declared).toContain(entry.year);
		}
	});

	it('never reports a negative count', () => {
		for (const slug of ['eastbourne', 'dawlish-warren', 'southend-chalkwell']) {
			for (const entry of [
				...(getSpillHistory(slug)?.attributed ?? []),
				...(getSpillHistory(slug)?.nearby ?? [])
			]) {
				expect(entry.spills).toBeGreaterThanOrEqual(0);
				expect(entry.overflows).toBeGreaterThan(0);
			}
		}
	});
});

describe('spillTrend', () => {
	it('needs two years to compare', () => {
		expect(spillTrend([])).toBeNull();
		expect(spillTrend(years([2025, 10]))).toBeNull();
	});

	it('reports a fall as a negative percentage', () => {
		expect(spillTrend(years([2021, 100], [2025, 60]))?.changePct).toBe(-40);
	});

	it('reports a rise as a positive percentage', () => {
		expect(spillTrend(years([2021, 50], [2025, 75]))?.changePct).toBe(50);
	});

	it('compares the earliest and latest year whatever the order', () => {
		const trend = spillTrend(years([2025, 60], [2021, 100], [2023, 80]));
		expect(trend?.from.year).toBe(2021);
		expect(trend?.to.year).toBe(2025);
	});

	// Dividing by a zero baseline yields Infinity, which would render as
	// "Infinity% more spills". No comparison is better than that.
	it('declines to compare against a year with no spills', () => {
		expect(spillTrend(years([2021, 0], [2025, 40]))).toBeNull();
	});
});

describe('comparableSpillYears', () => {
	// The 2021 return left 847 overflows without a count. Reading those as zero
	// turned Seahouses North's 2021 into 6 spills against 43 the next year, and
	// the page announced a 617% rise that never happened.
	it('drops a year missing more than a tenth of its counts', () => {
		const patchy: SpillYear[] = [
			{ year: 2021, overflows: 4, spills: 6, unmonitored: 1 },
			{ year: 2022, overflows: 4, spills: 43 }
		];
		expect(comparableSpillYears(patchy).map((y) => y.year)).toEqual([2022]);
		expect(spillTrend(patchy)).toBeNull();
	});

	it('keeps a year with only a small gap in monitoring', () => {
		const years: SpillYear[] = [
			{ year: 2021, overflows: 100, spills: 500, unmonitored: 5 },
			{ year: 2022, overflows: 100, spills: 400 }
		];
		expect(comparableSpillYears(years)).toHaveLength(2);
		expect(spillTrend(years)?.changePct).toBe(-20);
	});

	it('sorts oldest first', () => {
		const years: SpillYear[] = [
			{ year: 2025, overflows: 1, spills: 3 },
			{ year: 2021, overflows: 1, spills: 1 }
		];
		expect(comparableSpillYears(years).map((y) => y.year)).toEqual([2021, 2025]);
	});

	// Whatever the chart shows, the trend must be drawn from the same years, or
	// a reader sees a percentage that contradicts the bars beside it.
	it('agrees with the trend on which years count', () => {
		const record = getSpillHistory('seahouses-north');
		const shown = comparableSpillYears(record?.attributed ?? []);
		const trend = spillTrend(record?.attributed ?? []);
		expect(trend?.from.year).toBe(shown[0].year);
		expect(trend?.to.year).toBe(shown[shown.length - 1].year);
	});
});

describe('latestSpillYear', () => {
	it('returns null when there is nothing on record', () => {
		expect(latestSpillYear([])).toBeNull();
	});

	it('picks the most recent year regardless of order', () => {
		expect(latestSpillYear(years([2023, 5], [2025, 9], [2021, 1]))?.year).toBe(2025);
	});
});
