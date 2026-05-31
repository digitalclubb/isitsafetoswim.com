/**
 * Normalise a UK postcode or outward code for routing and lookup, or null when
 * the input is not a plausible postcode. Returns the spaceless uppercase form,
 * for example "SW1A1AA" for a full postcode or "SW1A" for an outward code.
 */
const FULL_POSTCODE = /^[A-Z]{1,2}\d[A-Z\d]?\d[A-Z]{2}$/;
const OUTWARD_CODE = /^[A-Z]{1,2}\d[A-Z\d]?$/;

export function normalisePostcode(input: string): string | null {
	const cleaned = input.replace(/\s+/g, '').toUpperCase();
	if (FULL_POSTCODE.test(cleaned) || OUTWARD_CODE.test(cleaned)) return cleaned;
	return null;
}

/** True when the input looks like a full postcode rather than just an outward code. */
export function isFullPostcode(input: string): boolean {
	return FULL_POSTCODE.test(input.replace(/\s+/g, '').toUpperCase());
}
