import { getAllLocations, getIndexMeta } from '$lib/data/locations';
import { getAllPlaces } from '$lib/data/places';

export const prerender = true;

const BASE = 'https://isitsafetoswim.com';

function escapeXml(value: string): string {
	return value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&apos;');
}

export const GET = () => {
	const meta = getIndexMeta();
	const lastmod = new Date(meta.generatedAt).toISOString().slice(0, 10);
	const urls = [
		`<url><loc>${BASE}/</loc><changefreq>daily</changefreq><priority>1.0</priority></url>`,
		`<url><loc>${BASE}/about</loc><changefreq>monthly</changefreq><priority>0.6</priority></url>`,
		`<url><loc>${BASE}/beaches</loc><changefreq>weekly</changefreq><priority>0.7</priority></url>`
	];

	for (const place of getAllPlaces()) {
		urls.push(
			`<url><loc>${BASE}/beaches/${escapeXml(place.slug)}</loc><lastmod>${lastmod}</lastmod><changefreq>weekly</changefreq><priority>0.7</priority></url>`
		);
	}

	for (const loc of getAllLocations()) {
		urls.push(
			`<url><loc>${BASE}/swim/${escapeXml(loc.slug)}</loc><lastmod>${lastmod}</lastmod><changefreq>daily</changefreq><priority>0.8</priority></url>`
		);
	}

	const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('\n')}
</urlset>`;

	return new Response(xml, {
		headers: {
			'content-type': 'application/xml; charset=utf-8',
			'cache-control': 'public, max-age=3600'
		}
	});
};
