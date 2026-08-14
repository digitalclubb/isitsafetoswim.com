import { describe, expect, it } from 'vitest';
import { redactAnalyticsUrl } from './redact';

const BASE = 'https://isitsafetoswim.com';

describe('redactAnalyticsUrl', () => {
	it('removes a searched postcode but keeps the route', () => {
		expect(redactAnalyticsUrl(`${BASE}/near/SW1A1AA`)).toBe(`${BASE}/near/[postcode]`);
		expect(redactAnalyticsUrl(`${BASE}/near/cf62`)).toBe(`${BASE}/near/[postcode]`);
	});

	it('removes an encoded postcode', () => {
		expect(redactAnalyticsUrl(`${BASE}/near/sw1a%201aa`)).toBe(`${BASE}/near/[postcode]`);
	});

	// The "near me" button rounds to roughly 110 metres and puts the result in
	// the query string, which is granular enough to place someone at home.
	it('removes the coordinates the near-me button writes into the query', () => {
		expect(redactAnalyticsUrl(`${BASE}/near?lat=51.388&lon=-3.274`)).toBe(
			`${BASE}/near?lat=redacted&lon=redacted`
		);
	});

	it('removes coordinates on any route, not just /near', () => {
		expect(redactAnalyticsUrl(`${BASE}/map?lat=51.388&lon=-3.274`)).toBe(
			`${BASE}/map?lat=redacted&lon=redacted`
		);
	});

	it('leaves the /near root and ordinary pages alone', () => {
		for (const path of ['/near', '/', '/swim/brean', '/beaches/wales', '/about#privacy']) {
			expect(redactAnalyticsUrl(`${BASE}${path}`)).toBe(`${BASE}${path}`);
		}
	});

	it('keeps other query parameters', () => {
		expect(redactAnalyticsUrl(`${BASE}/swim/brean?ref=hackernews`)).toBe(
			`${BASE}/swim/brean?ref=hackernews`
		);
	});

	it('redacts both a postcode and coordinates in the same URL', () => {
		expect(redactAnalyticsUrl(`${BASE}/near/SW1A1AA?lat=51.5&lon=-0.1`)).toBe(
			`${BASE}/near/[postcode]?lat=redacted&lon=redacted`
		);
	});

	it('returns an unparseable value untouched rather than throwing', () => {
		expect(redactAnalyticsUrl('http://')).toBe('http://');
	});
});
