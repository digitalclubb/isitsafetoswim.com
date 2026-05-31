import { describe, expect, it } from 'vitest';
import { isFullPostcode, normalisePostcode } from './postcode';

describe('normalisePostcode', () => {
	it('normalises a full postcode, stripping spaces and casing', () => {
		expect(normalisePostcode('sw1a 1aa')).toBe('SW1A1AA');
		expect(normalisePostcode('  M1 1AE ')).toBe('M11AE');
		expect(normalisePostcode('EC1A1BB')).toBe('EC1A1BB');
	});

	it('accepts an outward code on its own', () => {
		expect(normalisePostcode('SW1A')).toBe('SW1A');
		expect(normalisePostcode('m1')).toBe('M1');
	});

	it('rejects place names and other non-postcodes', () => {
		expect(normalisePostcode('Brighton')).toBeNull();
		expect(normalisePostcode('St Ives')).toBeNull();
		expect(normalisePostcode('')).toBeNull();
	});
});

describe('isFullPostcode', () => {
	it('distinguishes a full postcode from an outward code', () => {
		expect(isFullPostcode('SW1A 1AA')).toBe(true);
		expect(isFullPostcode('SW1A')).toBe(false);
	});
});
