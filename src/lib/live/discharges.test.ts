import { describe, expect, it } from 'vitest';
import { isDischarging } from './discharges';

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
