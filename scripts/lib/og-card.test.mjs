import { describe, expect, it } from 'vitest';
import { buildAreaCard, buildLocationCard, escapeXml, wrapText } from './og-card.mjs';

describe('escapeXml', () => {
	it('escapes the markup-significant characters', () => {
		expect(escapeXml('Tom & Jerry <"x">')).toBe('Tom &amp; Jerry &lt;&quot;x&quot;&gt;');
	});
});

describe('wrapText', () => {
	it('greedily wraps to lines within the limit', () => {
		expect(wrapText('one two three four', 8)).toEqual(['one two', 'three', 'four']);
	});

	it('keeps a short name on one line', () => {
		expect(wrapText('Fistral Beach', 17)).toEqual(['Fistral Beach']);
	});
});

describe('buildLocationCard', () => {
	it('renders a 1200x630 SVG with the name, place and rating', () => {
		const svg = buildLocationCard({
			name: 'Fistral Beach',
			region: 'Cornwall',
			country: 'England',
			classification: 'Excellent'
		});
		expect(svg).toContain('viewBox="0 0 1200 630"');
		expect(svg).toContain('Fistral Beach');
		expect(svg).toContain('Cornwall · England');
		expect(svg).toContain('Rated Excellent');
	});

	it('escapes a name containing an ampersand', () => {
		const svg = buildLocationCard({ name: 'A & B', country: 'Wales', classification: 'Good' });
		expect(svg).toContain('A &amp; B');
		expect(svg).not.toContain('A & B');
	});

	it('labels unknown and closed classifications without "Rated"', () => {
		expect(
			buildLocationCard({ name: 'X', country: 'Scotland', classification: 'Unknown' })
		).toContain('Not yet classified');
		expect(buildLocationCard({ name: 'X', country: 'Scotland', classification: 'Closed' })).toContain(
			'Currently closed'
		);
	});
});

describe('buildAreaCard', () => {
	it('renders the area headline and count', () => {
		const svg = buildAreaCard({ name: 'Cornwall', country: 'England', count: 90, kind: 'region' });
		// Matches the page's own title, so a shared card never contradicts it.
		expect(svg).toContain('Cleanest beaches in');
		expect(svg).toContain('Cornwall');
		expect(svg).toContain('90 designated bathing waters · England');
	});

	it('omits the country suffix for a country card', () => {
		const svg = buildAreaCard({ name: 'England', country: 'England', count: 464, kind: 'country' });
		expect(svg).toContain('464 designated bathing waters');
		expect(svg).not.toContain('· England');
	});
});
