import { describe, expect, it } from 'vitest';
import { buildDate, sitemapIndex, urlSet } from './sitemap';

describe('urlSet', () => {
	it('wraps entries in a urlset with absolute locations', async () => {
		const xml = await urlSet([{ path: '/swim/brean' }]).text();

		expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
		expect(xml).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
		expect(xml).toContain('<loc>https://isitsafetoswim.com/swim/brean</loc>');
		expect(xml).toContain('</urlset>');
	});

	it('emits lastmod only when the entry supplies one', async () => {
		const xml = await urlSet([
			{ path: '/swim/brean', lastmod: '2026-08-14' },
			{ path: '/about' }
		]).text();

		expect(xml).toContain(
			'<url><loc>https://isitsafetoswim.com/swim/brean</loc><lastmod>2026-08-14</lastmod></url>'
		);
		expect(xml).toContain('<url><loc>https://isitsafetoswim.com/about</loc></url>');
	});

	it('escapes characters that would otherwise break the document', async () => {
		const xml = await urlSet([{ path: "/swim/jackson's-bay-&-cold-knap" }]).text();

		expect(xml).toContain(
			'<loc>https://isitsafetoswim.com/swim/jackson&apos;s-bay-&amp;-cold-knap</loc>'
		);
		expect(xml).not.toContain("'s-bay-&-cold");
	});

	it('serves as cacheable XML', async () => {
		const res = urlSet([{ path: '/' }]);

		expect(res.headers.get('content-type')).toBe('application/xml; charset=utf-8');
		expect(res.headers.get('cache-control')).toBe('public, max-age=3600');
	});

	it('produces a well-formed document for an empty set', async () => {
		const xml = await urlSet([]).text();

		expect(xml).toContain('<urlset');
		expect(xml).toContain('</urlset>');
		expect(xml).not.toContain('<url>');
	});
});

describe('sitemapIndex', () => {
	it('lists children as sitemap entries rather than urls', async () => {
		const xml = await sitemapIndex([{ path: '/sitemap-swim.xml', lastmod: '2026-08-14' }]).text();

		expect(xml).toContain('<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
		expect(xml).toContain(
			'<sitemap><loc>https://isitsafetoswim.com/sitemap-swim.xml</loc><lastmod>2026-08-14</lastmod></sitemap>'
		);
		expect(xml).not.toContain('<url>');
	});

	it('omits lastmod when the child does not supply one', async () => {
		const xml = await sitemapIndex([{ path: '/sitemap-pages.xml' }]).text();

		expect(xml).toContain(
			'<sitemap><loc>https://isitsafetoswim.com/sitemap-pages.xml</loc></sitemap>'
		);
	});
});

describe('buildDate', () => {
	it('reduces an ISO timestamp to the date sitemaps expect', () => {
		expect(buildDate('2026-08-14T19:27:17.567Z')).toBe('2026-08-14');
	});

	// Throwing fails the prerender loudly rather than shipping a sitemap full of
	// invalid dates, which Google would hold against every URL in the file.
	it('throws rather than emitting a bad date', () => {
		expect(() => buildDate('not a date')).toThrow(RangeError);
	});
});
