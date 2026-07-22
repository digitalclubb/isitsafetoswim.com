import { describe, expect, it } from 'vitest';
import { isAdverseRating, ratingLabel } from './rating';
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
