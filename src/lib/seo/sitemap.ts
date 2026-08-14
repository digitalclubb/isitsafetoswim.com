const BASE = 'https://isitsafetoswim.com';

export interface SitemapEntry {
	path: string;
	lastmod?: string;
}

function escapeXml(value: string): string {
	return value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&apos;');
}

/**
 * Google ignores changefreq and priority outright, so neither is emitted. It
 * does read lastmod, but only while it stays trustworthy, which means a date
 * is written only where the catalogue actually knows one.
 */
function url({ path, lastmod }: SitemapEntry): string {
	const loc = `<loc>${escapeXml(`${BASE}${path}`)}</loc>`;
	return `<url>${loc}${lastmod ? `<lastmod>${lastmod}</lastmod>` : ''}</url>`;
}

function xml(body: string): Response {
	return new Response(`<?xml version="1.0" encoding="UTF-8"?>\n${body}`, {
		headers: {
			'content-type': 'application/xml; charset=utf-8',
			'cache-control': 'public, max-age=3600'
		}
	});
}

export function urlSet(entries: SitemapEntry[]): Response {
	return xml(
		`<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.map(url).join('\n')}\n</urlset>`
	);
}

export function sitemapIndex(children: SitemapEntry[]): Response {
	const items = children.map(
		({ path, lastmod }) =>
			`<sitemap><loc>${escapeXml(`${BASE}${path}`)}</loc>${
				lastmod ? `<lastmod>${lastmod}</lastmod>` : ''
			}</sitemap>`
	);
	return xml(
		`<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${items.join('\n')}\n</sitemapindex>`
	);
}

/** The catalogue build date, as the YYYY-MM-DD that lastmod expects. */
export function buildDate(generatedAt: string): string {
	return new Date(generatedAt).toISOString().slice(0, 10);
}
