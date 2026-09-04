import { describe, expect, it } from 'vitest';
import { getAllLocations } from './locations';

/**
 * The classification history is the one series on the site that spans a decade,
 * so the things worth pinning are that it contains only real assessments and
 * that its one genuine gap stays a gap.
 */
describe('classification history in the catalogue', () => {
	const withHistory = getAllLocations().filter((l) => (l.classificationHistory ?? []).length > 0);

	it('covers England and Wales', () => {
		expect(withHistory.length).toBeGreaterThan(500);
		const countries = new Set(withHistory.map((l) => l.country));
		expect(countries.has('England')).toBe(true);
		expect(countries.has('Wales')).toBe(true);
	});

	it('never carries 2020, which was never classified', () => {
		// The pandemic cut the bathing season short and no assessment was made.
		for (const l of withHistory) {
			expect(l.classificationHistory?.some((h) => h.year === 2020)).toBe(false);
		}
	});

	it('starts no earlier than the revised regime in 2015', () => {
		// Everything before 2015 is a projected assessment: the regulator's
		// back-cast, not a classification any site was awarded.
		for (const l of withHistory) {
			expect(l.classificationHistory?.[0].year).toBeGreaterThanOrEqual(2015);
		}
	});

	it('runs oldest first with no repeated year', () => {
		for (const l of withHistory) {
			const years = (l.classificationHistory ?? []).map((h) => h.year);
			expect([...years].sort((a, b) => a - b)).toEqual(years);
			expect(new Set(years).size).toBe(years.length);
		}
	});

	it('reports Closed only as a rare status, not as a common value', () => {
		const closed = withHistory.filter((l) =>
			l.classificationHistory?.some((h) => h.classification === 'Closed')
		);
		expect(closed.length).toBeGreaterThan(0);
		expect(closed.length).toBeLessThan(withHistory.length * 0.05);
	});

	it('agrees with the current classification on the latest year', () => {
		for (const l of withHistory) {
			const latest = l.classificationHistory?.[l.classificationHistory.length - 1];
			if (latest?.year !== l.classificationYear) continue;
			expect(latest?.classification).toBe(l.classification);
		}
	});

	it('holds only ratings the regulator actually awarded, plus Closed', () => {
		// Closed is a real reported status for a season a site was not open, not a
		// parser catch-all, so it belongs in the record. The chart draws it as an
		// absence rather than as a low bar.
		const allowed = new Set(['Excellent', 'Good', 'Sufficient', 'Poor', 'Closed']);
		for (const l of withHistory) {
			for (const h of l.classificationHistory ?? []) {
				expect(allowed.has(h.classification)).toBe(true);
			}
		}
	});

	it('never carries a parser catch-all in the record', () => {
		for (const l of withHistory) {
			for (const h of l.classificationHistory ?? []) {
				expect(h.classification).not.toBe('Unknown');
				expect(h.classification).not.toBe('New');
			}
		}
	});
});

describe('Scottish water types', () => {
	const scotland = getAllLocations().filter((l) => l.country === 'Scotland');

	it('types the three freshwater lochs as inland', () => {
		const inland = scotland
			.filter((l) => l.waterType === 'inland')
			.map((l) => l.slug)
			.sort();
		expect(inland).toEqual(['dores', 'loch-morlich', 'luss-bay']);
	});

	it('keeps sea lochs coastal, so they keep the stricter thresholds', () => {
		// Ballachulish is on Loch Leven, salt water, and is off the marine grid
		// only because the loch is narrow. Inland thresholds are more forgiving,
		// so guessing wrong here would weaken a safety cut-off.
		const ballachulish = scotland.find((l) => /ballachulish/i.test(l.slug));
		expect(ballachulish?.waterType).toBe('coastal');
	});

	it('leaves the rest of Scotland coastal', () => {
		expect(scotland.filter((l) => l.waterType === 'coastal').length).toBe(scotland.length - 3);
	});
});
