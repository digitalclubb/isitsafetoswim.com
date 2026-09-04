import { describe, expect, it } from 'vitest';
import { getAllPlaces, getPlaceBySlug } from './places';

/**
 * Runs against the committed catalogue, because the claim worth defending is
 * about real data: a place where no classification is published must never be
 * described as though one had been checked and come back poorly.
 */
describe('getPlaceBySlug', () => {
	it('marks England as classified', () => {
		expect(getPlaceBySlug('england')?.classified).toBe(true);
	});

	it('marks Northern Ireland as unclassified, because DAERA publishes none', () => {
		expect(getPlaceBySlug('northern-ireland')?.classified).toBe(false);
	});

	it('still orders an unclassified place by the regulator reading', () => {
		// Otherwise the page is 33 rows of alphabet presented as a ranking.
		const ni = getPlaceBySlug('northern-ireland');
		expect(ni).not.toBeNull();
		const levels = (ni?.ranked ?? []).map((l) => l.currentAssessment?.level);
		const advised = levels.indexOf('advised-against');
		const good = levels.lastIndexOf('good');
		expect(advised).toBeGreaterThan(good);
	});

	it('fills cleanest from the reading where no classification exists', () => {
		const ni = getPlaceBySlug('northern-ireland');
		expect((ni?.cleanest ?? []).length).toBeGreaterThan(0);
		for (const l of ni?.cleanest ?? []) {
			expect(l.currentAssessment?.level).toBe('good');
		}
	});

	it('never puts an advised-against site in cleanest', () => {
		for (const place of getAllPlaces()) {
			const page = getPlaceBySlug(place.slug);
			for (const l of page?.cleanest ?? []) {
				expect(l.currentAssessment?.level).not.toBe('advised-against');
			}
		}
	});

	it('keeps classified places ranking on classification', () => {
		const england = getPlaceBySlug('england');
		const ranked = england?.ranked ?? [];
		const firstPoor = ranked.findIndex((l) => l.classification === 'Poor');
		const lastExcellent = ranked.map((l) => l.classification).lastIndexOf('Excellent');
		expect(firstPoor).toBeGreaterThan(lastExcellent);
	});
});
