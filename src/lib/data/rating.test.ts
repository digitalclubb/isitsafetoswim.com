import { describe, expect, it } from 'vitest';
import { classificationChange, isAdverseRating, ratingLabel } from './rating';
import type { Classification } from './types';

describe('ratingLabel', () => {
	it('prefixes the four rated tiers so the value cannot read as a verdict', () => {
		expect(ratingLabel('Excellent').label).toBe('Rated Excellent');
		expect(ratingLabel('Good').label).toBe('Rated Good');
		expect(ratingLabel('Sufficient').label).toBe('Rated Sufficient');
		expect(ratingLabel('Poor').label).toBe('Rated Poor');
	});

	it('announces the tier without the shorthand', () => {
		expect(ratingLabel('Excellent').announced).toBe('Annual classification: Excellent');
	});

	// Unknown is the parser's catch-all, so it covers established waters whose
	// classification did not parse. Neither label may imply the site is new.
	it('gives New and Unknown the same non-committal label', () => {
		expect(ratingLabel('New')).toEqual(ratingLabel('Unknown'));
		expect(ratingLabel('Unknown').label).toBe('Unclassified');
	});

	it('never claims a site is newly designated or unrated', () => {
		const claims = /newly|not yet rated/i;
		const all: Classification[] = [
			'Excellent',
			'Good',
			'Sufficient',
			'Poor',
			'New',
			'Closed',
			'Unknown'
		];
		for (const c of all) {
			expect(ratingLabel(c).label).not.toMatch(claims);
			expect(ratingLabel(c).announced).not.toMatch(claims);
		}
	});

	it('never borrows the verdict vocabulary', () => {
		const verdictWords = /\b(yes|caution|no|today)\b/i;
		const all: Classification[] = ['Excellent', 'Good', 'Sufficient', 'Poor', 'Unknown'];
		for (const c of all) expect(ratingLabel(c).label).not.toMatch(verdictWords);
	});
});

describe('isAdverseRating', () => {
	it('flags the classifications that warn', () => {
		expect(isAdverseRating('Poor')).toBe(true);
		expect(isAdverseRating('Closed')).toBe(true);
	});

	it('leaves the rest unemphasised', () => {
		for (const c of ['Excellent', 'Good', 'Sufficient', 'New', 'Unknown'] as Classification[]) {
			expect(isAdverseRating(c)).toBe(false);
		}
	});
});

describe('classificationChange', () => {
	it('reports a rise', () => {
		expect(classificationChange('Excellent', 'Good')).toEqual({ direction: 'up', from: 'Good' });
	});

	it('reports a fall', () => {
		expect(classificationChange('Sufficient', 'Good')).toEqual({ direction: 'down', from: 'Good' });
	});

	it('returns null when the rating held', () => {
		expect(classificationChange('Excellent', 'Excellent')).toBeNull();
	});

	it('returns null with no previous classification', () => {
		expect(classificationChange('Good', undefined)).toBeNull();
	});

	it('does not rank a status as a rise or a fall', () => {
		// Closed is not "worse water" and Unknown is a parser catch-all, so
		// neither may be reported as a movement in quality.
		expect(classificationChange('Closed', 'Excellent')).toBeNull();
		expect(classificationChange('Excellent', 'Unknown')).toBeNull();
		expect(classificationChange('Good', 'New')).toBeNull();
	});
});

describe('ratingLabel with a regulator reading', () => {
	const recent = new Date(Date.now() - 3 * 24 * 36e5).toISOString();

	it('shows the reading where no classification exists', () => {
		// Northern Ireland has no annual classification. Labelling those cards
		// "Unclassified" discards the only thing DAERA does publish.
		expect(
			ratingLabel('Unknown', { level: 'good', label: 'Excellent', assessedAt: recent }).label
		).toBe('Latest reading Excellent');
	});

	it('keeps a reading visibly apart from a rating', () => {
		// "Rated Excellent" is a multi-year percentile. One week's sample is not,
		// and must never be worded as though it were.
		const reading = ratingLabel('Unknown', {
			level: 'good',
			label: 'Excellent',
			assessedAt: recent
		});
		expect(reading.label).not.toBe('Rated Excellent');
		expect(reading.announced).toContain('reading');
	});

	it('flags advice against bathing rather than showing it as a reading', () => {
		const label = ratingLabel('Unknown', {
			level: 'advised-against',
			label: 'Advised against bathing'
		});
		expect(label.label).toBe('Advised against');
		expect(isAdverseRating('Unknown', { level: 'advised-against', label: 'x' })).toBe(true);
	});

	it('prefers a real classification over a reading', () => {
		expect(ratingLabel('Good', { level: 'good', label: 'Excellent', assessedAt: recent }).label).toBe(
			'Rated Good'
		);
	});

	it('still says unclassified when there is neither', () => {
		expect(ratingLabel('Unknown').label).toBe('Unclassified');
		expect(isAdverseRating('Unknown')).toBe(false);
	});
});

describe('a regulator reading ages out on cards too', () => {
	const fresh = new Date(Date.now() - 3 * 24 * 36e5).toISOString();
	const old = new Date(Date.now() - 200 * 24 * 36e5).toISOString();

	it('calls a recent reading the latest one', () => {
		expect(
			ratingLabel('Unknown', { level: 'good', label: 'Excellent', assessedAt: fresh }).label
		).toBe('Latest reading Excellent');
	});

	it('stops calling an out-of-date reading the latest one', () => {
		// Sampling stops on 15 September, so without this every NI card would read
		// "Latest reading Excellent" all winter beside a page that had demoted the
		// same site to Caution for being out of date.
		const label = ratingLabel('Unknown', { level: 'good', label: 'Excellent', assessedAt: old });
		expect(label.label).toBe('Last reading Excellent');
		expect(label.announced).toContain('out of date');
	});

	it('treats an undated reading as out of date, as the engine does', () => {
		expect(ratingLabel('Unknown', { level: 'good', label: 'Excellent' }).label).toBe(
			'Last reading Excellent'
		);
	});

	it('never ages out advice against bathing', () => {
		expect(
			ratingLabel('Unknown', {
				level: 'advised-against',
				label: 'Advised against bathing',
				assessedAt: old
			}).label
		).toBe('Advised against');
	});
});
