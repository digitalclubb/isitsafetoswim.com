import { describe, expect, it } from 'vitest';
import { getSpillLeague, getSpillLeaguePlaces } from './spill-league';

/**
 * These run against the committed catalogue and spill record rather than
 * fixtures, because the claims worth defending are about the real data: that
 * no beach is ranked on a figure it does not have, and that a beach with no
 * record never appears as a clean one.
 */
describe('getSpillLeague', () => {
	const england = getSpillLeague('england');

	it('ranks England on a single year', () => {
		expect(england).not.toBeNull();
		expect(england?.year).toBe(2025);
	});

	it('ranks worst first', () => {
		const spills = england?.entries.map((e) => e.spills) ?? [];
		expect(spills.length).toBeGreaterThan(100);
		for (let i = 1; i < spills.length; i += 1) {
			expect(spills[i]).toBeLessThanOrEqual(spills[i - 1]);
		}
	});

	it('leaves out every site with no attributed record rather than ranking it zero', () => {
		// No record is not a clean record. Coverage must stay short of the total.
		expect(england?.withRecord).toBeLessThan(england?.total ?? 0);
		expect(england?.ranked).toBe(england?.entries.length);
	});

	it('distinguishes sites holding a record from sites ranked in the shown year', () => {
		// These are different numbers and the page states both. Conflating them
		// told readers that a site with a 2023 record had no record at all.
		expect(england?.ranked).toBeLessThanOrEqual(england?.withRecord ?? 0);
	});

	it('carries a real overflow count on every row', () => {
		for (const entry of england?.entries ?? []) {
			expect(entry.overflows).toBeGreaterThan(0);
			expect(entry.spills).toBeGreaterThanOrEqual(0);
		}
	});

	it('measures each trend from a year that site actually has', () => {
		for (const entry of england?.entries ?? []) {
			if (entry.changePct === null) continue;
			expect(entry.changeFrom).not.toBeNull();
			expect(entry.changeFrom).toBeLessThan(england?.year ?? 0);
		}
	});

	it('totals the spills it lists', () => {
		const summed = england?.entries.reduce((sum, e) => sum + e.spills, 0);
		expect(england?.totalSpills).toBe(summed);
	});

	it('scopes a region to its own beaches', () => {
		const region = getSpillLeaguePlaces().find((p) => p.kind === 'region');
		expect(region).toBeDefined();
		const league = getSpillLeague(region?.slug ?? '');
		expect(league).not.toBeNull();
		for (const entry of league?.entries ?? []) {
			expect(entry.location.region).toBe(region?.name);
		}
	});

	it('refuses a place outside England, because the return is an England publication', () => {
		expect(getSpillLeague('wales')).toBeNull();
		expect(getSpillLeague('scotland')).toBeNull();
		expect(getSpillLeague('northern-ireland')).toBeNull();
	});

	it('returns null for an unknown slug', () => {
		expect(getSpillLeague('not-a-place')).toBeNull();
	});
});

describe('getSpillLeaguePlaces', () => {
	const places = getSpillLeaguePlaces();

	it('offers English regions only', () => {
		// England is the hub at /beaches/sewage. A second England page under
		// [place] would carry identical rows and the identical title.
		expect(places.some((p) => p.kind === 'country')).toBe(false);
		expect(places.every((p) => p.country === 'England')).toBe(true);
		expect(places.length).toBeGreaterThan(5);
	});

	it('offers no page it cannot then build', () => {
		for (const place of places) {
			expect(getSpillLeague(place.slug)).not.toBeNull();
		}
	});

	it('offers no region too small to read as a table', () => {
		for (const place of places) {
			if (place.kind !== 'region') continue;
			expect(getSpillLeague(place.slug)?.entries.length ?? 0).toBeGreaterThanOrEqual(5);
		}
	});

	it('never offers England, which the hub already carries', () => {
		expect(places.some((p) => p.slug === 'england')).toBe(false);
	});
});
