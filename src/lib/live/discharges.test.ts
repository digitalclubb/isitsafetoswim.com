import { describe, expect, it } from 'vitest';
import { getAllLocations } from '$lib/data/locations';
import { hasDischargeFeed, isDischarging, operatorMap } from './discharges';

describe('isDischarging', () => {
	it('reads the English companies 1/0 flag', () => {
		expect(isDischarging(1)).toBe(true);
		expect(isDischarging('1')).toBe(true);
		expect(isDischarging(0)).toBe(false);
		expect(isDischarging('0')).toBe(false);
	});

	it('reads Welsh Water phrasing', () => {
		expect(isDischarging('Overflow Operating')).toBe(true);
		expect(isDischarging('Overflow Not Operating')).toBe(false);
	});

	it('does not call a finished Welsh spill ongoing', () => {
		// "Overflow Not Operating (Has in the last 24 hours)" contains the word
		// "Operating". Matching on that substring would report a spill that ended
		// hours ago as still running, which is a hard No on the beach page.
		expect(isDischarging('Overflow Not Operating (Has in the last 24 hours)')).toBe(false);
	});

	it('treats an unresolved status as not discharging', () => {
		expect(isDischarging('Under Investigation')).toBe(false);
	});

	it('reads the discharging wording the other feeds use', () => {
		expect(isDischarging('Discharging')).toBe(true);
		expect(isDischarging('Not discharging')).toBe(false);
	});

	it('is false for anything it cannot read', () => {
		expect(isDischarging(undefined)).toBe(false);
		expect(isDischarging(null)).toBe(false);
		expect(isDischarging({})).toBe(false);
		expect(isDischarging('')).toBe(false);
	});
});

describe('operatorMap', () => {
	it('resolves a map for every site that has a live feed', () => {
		// The names come from the EA's catalogue, not from the table under test,
		// so a rename or a new operator fails here rather than silently dropping
		// the link on every one of that company's beaches.
		const feeds = getAllLocations().filter((l) => hasDischargeFeed(l));
		expect(feeds.length).toBeGreaterThan(500);
		const missing = feeds
			.filter((l) => operatorMap(l.sewerageUndertaker) === null)
			.map((l) => l.sewerageUndertaker);
		expect([...new Set(missing)]).toEqual([]);
	});

	it('offers nothing where there is no feed to check against', () => {
		const noFeed = getAllLocations().filter((l) => !hasDischargeFeed(l));
		expect(noFeed.every((l) => operatorMap(l.sewerageUndertaker) === null)).toBe(true);
	});

	it('links out over https', () => {
		expect(operatorMap('Thames Water Utilities Ltd')?.url).toMatch(/^https:\/\//);
	});

	it('uses the trading name, not the EA legal name', () => {
		expect(operatorMap('Dwr Cymru Cyfyngedig')?.label).toBe('Welsh Water');
	});

	it('is null for an operator we have no map for', () => {
		expect(operatorMap(undefined)).toBeNull();
		expect(operatorMap('Scottish Water')).toBeNull();
	});
});
