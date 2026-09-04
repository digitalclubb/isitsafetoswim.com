import { describe, expect, it } from 'vitest';
import { buildAreaCard, buildLocationCard, escapeXml, fitFontSize, wrapText } from './og-card.mjs';

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

describe('buildLocationCard where no classification is published', () => {
	it('shows the regulator reading rather than promising a classification', () => {
		const svg = buildLocationCard({
			name: 'Magilligan Benone',
			country: 'Northern Ireland',
			classification: 'Unknown',
			currentAssessment: {
				level: 'good',
				label: 'Excellent',
				assessedAt: new Date(Date.now() - 3 * 24 * 36e5).toISOString()
			}
		});
		expect(svg).toContain('Latest reading Excellent');
		expect(svg).not.toContain('Not yet classified');
	});

	it('stops calling an out-of-date reading the latest one', () => {
		const svg = buildLocationCard({
			name: 'Magilligan Benone',
			country: 'Northern Ireland',
			classification: 'Unknown',
			currentAssessment: {
				level: 'good',
				label: 'Excellent',
				assessedAt: new Date(Date.now() - 200 * 24 * 36e5).toISOString()
			}
		});
		expect(svg).toContain('Last reading Excellent');
	});

	it('does not put an advised-against site on a neutral card', () => {
		const svg = buildLocationCard({
			name: "Rea's Wood",
			country: 'Northern Ireland',
			classification: 'Unknown',
			currentAssessment: { level: 'advised-against', label: 'Advised against bathing' }
		});
		expect(svg).toContain('Advised against bathing');
		expect(svg).not.toContain('Not yet classified');
	});

	it('still says not yet classified where there is no reading either', () => {
		const svg = buildLocationCard({
			name: 'Somewhere',
			country: 'England',
			classification: 'Unknown'
		});
		expect(svg).toContain('Not yet classified');
	});
});

describe('fitFontSize', () => {
	it('leaves a short line at the base size', () => {
		expect(fitFontSize('Cornwall · England', 1040, 40)).toBe(40);
	});

	it('shrinks a line that would run off the card', () => {
		// The longest real one, which used to be clipped mid-word.
		const long = 'Causeway Coast and Glens Borough Council · Northern Ireland';
		const size = fitFontSize(long, 1040, 40);
		expect(size).toBeLessThan(40);
		expect(long.length * size * 0.48).toBeLessThanOrEqual(1040);
	});

	it('never shrinks below the legibility floor', () => {
		expect(fitFontSize('x'.repeat(500), 1040, 40)).toBe(26);
	});
});
