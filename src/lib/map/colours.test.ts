import { describe, expect, it } from 'vitest';
import type { Verdict } from '$lib/data/types';
import { VERDICT_LEGEND, verdictHex, verdictLabel } from './colours';

describe('verdict colours', () => {
	const verdicts: Verdict[] = ['yes', 'caution', 'no'];

	it('maps every verdict to a distinct hex', () => {
		const hexes = verdicts.map(verdictHex);
		expect(new Set(hexes).size).toBe(3);
		for (const hex of hexes) expect(hex).toMatch(/^#[0-9a-f]{6}$/);
	});

	it('matches the brand verdict tokens', () => {
		// Locked to the --yes/--caution/--no values in tokens.css.
		expect(verdictHex('yes')).toBe('#1f6f4b');
		expect(verdictHex('caution')).toBe('#7a4a08');
		expect(verdictHex('no')).toBe('#9b2c2c');
	});

	it('labels each verdict', () => {
		expect(verdictLabel('yes')).toBe('Yes');
		expect(verdictLabel('caution')).toBe('Caution');
		expect(verdictLabel('no')).toBe('No');
	});

	it('exposes a legend covering all three verdicts in order', () => {
		expect(VERDICT_LEGEND.map((l) => l.verdict)).toEqual(['yes', 'caution', 'no']);
		for (const entry of VERDICT_LEGEND) {
			expect(entry.hex).toBe(verdictHex(entry.verdict));
			expect(entry.label).toBe(verdictLabel(entry.verdict));
			expect(entry.meaning.length).toBeGreaterThan(0);
		}
	});
});
