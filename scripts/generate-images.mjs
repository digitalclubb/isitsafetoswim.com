// Rasterise the brand SVG and OG SVG into PNG variants, and a per-location and
// per-area social share card. Runs at build time after the location index step.

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Resvg } from '@resvg/resvg-js';
import { buildAreaCard, buildLocationCard } from './lib/og-card.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..');
const staticDir = resolve(repoRoot, 'static');

// Bundle the font so text renders identically whatever fonts the build host
// happens to have (Vercel's build image has few). Source Serif 4 is OFL.
const FONT = {
	fontFiles: [resolve(here, 'fonts/SourceSerif4.ttf')],
	loadSystemFonts: false,
	defaultFontFamily: 'Source Serif 4'
};

async function renderSvgFile(svgPath, outputPath, fitWidth) {
	const svg = await readFile(svgPath, 'utf8');
	const png = new Resvg(svg, {
		fitTo: { mode: 'width', value: fitWidth },
		background: 'rgba(0,0,0,0)',
		font: FONT
	})
		.render()
		.asPng();
	await writeFile(outputPath, png);
}

async function renderCard(svg, outputPath) {
	const png = new Resvg(svg, { font: FONT }).render().asPng();
	await writeFile(outputPath, png);
}

const iconTasks = [
	{ from: 'icon.svg', to: 'icon-192.png', width: 192 },
	{ from: 'icon.svg', to: 'icon-512.png', width: 512 },
	{ from: 'icon.svg', to: 'icon-maskable-512.png', width: 512 },
	{ from: 'og.svg', to: 'og.png', width: 1200 }
];

for (const task of iconTasks) {
	await renderSvgFile(resolve(staticDir, task.from), resolve(staticDir, task.to), task.width);
}

function slugify(input) {
	return input
		.normalize('NFKD')
		.replace(/[̀-ͯ]/g, '')
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');
}

// Mirror the area taxonomy in src/lib/data/places.ts (countries, plus regions
// with at least five sites). Kept in step by the shared REGION_MIN and slug rule.
const REGION_MIN = 5;

const index = JSON.parse(await readFile(resolve(repoRoot, 'src/data/locations.json'), 'utf8'));
const locations = index.locations;

const places = [];
for (const [country, count] of Object.entries(index.byCountry)) {
	if (count) places.push({ slug: slugify(country), name: country, kind: 'country', country, count });
}
const regionCounts = new Map();
for (const loc of locations) {
	if (!loc.region) continue;
	const key = `${loc.country}|${loc.region}`;
	const entry = regionCounts.get(key) ?? { name: loc.region, country: loc.country, count: 0 };
	entry.count += 1;
	regionCounts.set(key, entry);
}
for (const { name, country, count } of regionCounts.values()) {
	if (count >= REGION_MIN)
		places.push({ slug: slugify(name), name, kind: 'region', country, count });
}

// places.ts disambiguates a slug collision by appending the country; this
// script does not, so fail loudly if the taxonomy ever produces a duplicate
// rather than silently overwriting a card and serving a 404 og:image.
const seenSlugs = new Set();
for (const place of places) {
	if (seenSlugs.has(place.slug)) {
		throw new Error(
			`[generate-images] duplicate area slug "${place.slug}"; slug logic has drifted from places.ts`
		);
	}
	seenSlugs.add(place.slug);
}

await mkdir(resolve(staticDir, 'og/swim'), { recursive: true });
await mkdir(resolve(staticDir, 'og/beaches'), { recursive: true });

for (const loc of locations) {
	await renderCard(buildLocationCard(loc), resolve(staticDir, 'og/swim', `${loc.slug}.png`));
}
for (const place of places) {
	await renderCard(buildAreaCard(place), resolve(staticDir, 'og/beaches', `${place.slug}.png`));
}

console.log(
	`[generate-images] ${iconTasks.length} brand images, ${locations.length} location cards, ${places.length} area cards`
);
