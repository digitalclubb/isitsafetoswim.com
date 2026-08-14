// Compile the unified UK bathing-water location index used at runtime.
//
// Data sources:
//   - England: Environment Agency Linked Data
//   - Wales:   Natural Resources Wales (same Linked Data stack)
//   - Scotland: SEPA ArcGIS MapServer
//   - Northern Ireland: DAERA ArcGIS FeatureServer
//
// All four are live JSON APIs. Any regulator the build cannot reach is
// backfilled from the previous on-disk index so an outage never blocks a
// deploy. The build only aborts when a regulator fails and the cache holds no
// rows for its country. Override via env CACHE_ONLY=1 to skip the network.

import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { applyDisplayNames } from './lib/display-names.mjs';
import {
	classifyValue,
	dedupeSlugs,
	extractLabel,
	lastNonEmptyPathSegment,
	readEaBoolean,
	readSamplingPoint,
	slugify,
	waterTypeFromEaType
} from './lib/parsers.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..');
const outFile = resolve(repoRoot, 'src', 'data', 'locations.json');
const cacheFile = resolve(here, '.locations.cache.json');

const USER_AGENT = 'isitsafetoswim/0.1 (+https://isitsafetoswim.com)';
const PAGE_SIZE = 200;
const FETCH_TIMEOUT_MS = 20_000;
const FETCHER_BUDGET_MS = 90_000;
const MAX_PAGES = 50;
const CACHE_ONLY = process.env.CACHE_ONLY === '1';

const COUNTRY = {
	ENGLAND: 'England',
	WALES: 'Wales',
	SCOTLAND: 'Scotland',
	NI: 'Northern Ireland'
};

// England (EA) and Wales (NRW) are both served from environment.data.gov.uk,
// which 403s datacentre IP ranges, so on Vercel they fail together. When a
// regulator is unreachable we backfill its rows from the committed cache rather
// than refusing the build: this index is the static catalogue (names, location,
// annual classification), not the live verdict data, so cached rows cost no
// freshness. The build only aborts if a regulator fails and the cache cannot
// cover it.
const FETCHER_COUNTRY = {
	'England (EA)': COUNTRY.ENGLAND,
	'Wales (NRW)': COUNTRY.WALES,
	'Scotland (SEPA)': COUNTRY.SCOTLAND,
	'Northern Ireland (DAERA)': COUNTRY.NI
};

async function fetchJson(url, options = {}) {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
	try {
		const res = await fetch(url, {
			...options,
			headers: { 'user-agent': USER_AGENT, accept: 'application/json', ...options.headers },
			signal: controller.signal,
			redirect: 'follow'
		});
		if (!res.ok) {
			throw new Error(`${res.status} ${res.statusText} for ${url}`);
		}
		return await res.json();
	} finally {
		clearTimeout(timer);
	}
}

async function withBudget(label, fn, budgetMs = FETCHER_BUDGET_MS) {
	let timer;
	const budget = new Promise((_, reject) => {
		timer = setTimeout(() => reject(new Error(`${label} exceeded ${budgetMs}ms budget`)), budgetMs);
	});
	try {
		return await Promise.race([fn(), budget]);
	} finally {
		clearTimeout(timer);
	}
}

// ---- England -----------------------------------------------------------

async function fetchEngland() {
	const base = 'https://environment.data.gov.uk/doc/bathing-water.json';
	const out = [];
	let page = 0;
	for (; page < MAX_PAGES; page += 1) {
		const url = `${base}?_pageSize=${PAGE_SIZE}&_page=${page}`;
		const body = await fetchJson(url);
		const items = body.result?.items ?? [];
		if (items.length === 0) break;
		for (const item of items) {
			const name = extractLabel(item.name) ?? extractLabel(item.label) ?? extractLabel(item.title);
			if (typeof name !== 'string' || !name.trim()) continue;
			const point = readSamplingPoint(item.samplingPoint);
			if (!point) continue;
			const sourceId = item.eubwidNotation ?? lastNonEmptyPathSegment(item._about);
			if (!sourceId) continue;
			out.push({
				id: `ea-${sourceId}`,
				name: name.trim(),
				slug: slugify(name),
				country: COUNTRY.ENGLAND,
				region: extractLabel(item.district),
				lat: point.lat,
				lon: point.lon,
				classification: classifyValue(
					extractLabel(item.latestComplianceAssessment?.complianceClassification) ??
						extractLabel(item.latestComplianceAssessment)
				),
				sewerageUndertaker: extractLabel(item.appointedSewerageUndertaker),
				waterType: waterTypeFromEaType(item.type),
				rainImpacted: readEaBoolean(item.waterQualityImpactedByHeavyRain),
				source: {
					api: 'ea',
					sourceId,
					profileUrl: `https://environment.data.gov.uk/bwq/profiles/profile.html?site=${sourceId}`
				}
			});
		}
		if (!body.result?.next) break;
	}
	if (page === MAX_PAGES) {
		console.warn(`[build-location-index] England hit MAX_PAGES=${MAX_PAGES}, may be truncated`);
	}
	return out;
}

// ---- Wales -------------------------------------------------------------

async function fetchWales() {
	const base = 'https://environment.data.gov.uk/wales/bathing-waters/doc/bathing-water.json';
	const out = [];
	let page = 0;
	for (; page < MAX_PAGES; page += 1) {
		const url = `${base}?_pageSize=${PAGE_SIZE}&_page=${page}`;
		const body = await fetchJson(url);
		const items = body.result?.items ?? [];
		if (items.length === 0) break;
		for (const item of items) {
			const name = extractLabel(item.name) ?? extractLabel(item.label);
			if (typeof name !== 'string' || !name.trim()) continue;
			const point = readSamplingPoint(item.samplingPoint);
			if (!point) continue;
			const sourceId = item.eubwidNotation ?? lastNonEmptyPathSegment(item._about);
			if (!sourceId) continue;
			out.push({
				id: `nrw-${sourceId}`,
				name: name.trim(),
				slug: slugify(name),
				country: COUNTRY.WALES,
				region: extractLabel(item.district),
				lat: point.lat,
				lon: point.lon,
				classification: classifyValue(
					extractLabel(item.latestComplianceAssessment?.complianceClassification)
				),
				waterType: waterTypeFromEaType(item.type),
				rainImpacted: readEaBoolean(item.waterQualityImpactedByHeavyRain),
				source: {
					api: 'nrw',
					sourceId,
					profileUrl: `https://environment.data.gov.uk/wales/bathing-waters/profiles/profile.html?site=${sourceId}`
				}
			});
		}
		if (!body.result?.next) break;
	}
	if (page === MAX_PAGES) {
		console.warn(`[build-location-index] Wales hit MAX_PAGES=${MAX_PAGES}, may be truncated`);
	}
	return out;
}

// ---- Scotland ----------------------------------------------------------

async function fetchScotland() {
	const url =
		'https://map.sepa.org.uk/server/rest/services/Open/Environmental_Monitoring/MapServer/1/query?where=1%3D1&outFields=*&f=geojson&outSR=4326';
	const body = await fetchJson(url);
	const features = body.features ?? [];
	const out = [];
	for (const feature of features) {
		const props = feature.properties ?? {};
		const geom = feature.geometry?.coordinates ?? [];
		const lon = Number(geom[0]);
		const lat = Number(geom[1]);
		const name = props.description ?? props.Description ?? props.name;
		if (typeof name !== 'string' || !name.trim()) continue;
		if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
		const sourceId = String(props.objectid ?? props.OBJECTID ?? feature.id);
		out.push({
			id: `sepa-${sourceId}`,
			name: name.trim(),
			slug: slugify(name),
			country: COUNTRY.SCOTLAND,
			region: undefined,
			lat,
			lon,
			classification: classifyValue(props.class_description ?? props.classification),
			waterType: 'coastal',
			source: {
				api: 'sepa',
				sourceId,
				profileUrl: props.bw_url ?? 'https://apps.sepa.org.uk/bathingwaters/'
			}
		});
	}
	return out;
}

// ---- Northern Ireland --------------------------------------------------

async function fetchNorthernIreland() {
	const url =
		'https://services-eu1.arcgis.com/kswen6BYexuc1SUk/arcgis/rest/services/Bathing_Water_Monitoring_Points_Public_View_PRD/FeatureServer/0/query?where=1%3D1&outFields=*&f=geojson&outSR=4326';
	const body = await fetchJson(url);
	const features = body.features ?? [];
	const out = [];
	for (const feature of features) {
		const props = feature.properties ?? {};
		const geom = feature.geometry?.coordinates ?? [];
		const lon = Number(geom[0]);
		const lat = Number(geom[1]);
		const name = props.Bathing_Water_Site ?? props.Site_name ?? props.Name;
		if (typeof name !== 'string' || !name.trim()) continue;
		if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
		const sourceId = String(props.Unique_Site_ID_Code ?? props.OBJECTID ?? feature.id);
		out.push({
			id: `daera-${sourceId}`,
			name: name.trim(),
			slug: slugify(name),
			country: COUNTRY.NI,
			region: props.Bathing_Water_Operator ?? props.Region,
			lat,
			lon,
			classification: classifyValue(props.water_quality_indicator ?? props.Water_Quality_Indicator),
			waterType: String(props.Type ?? '').toLowerCase() === 'inland' ? 'inland' : 'coastal',
			source: {
				api: 'daera',
				sourceId,
				profileUrl:
					props.Profile__URL ??
					props.Poster_URL ??
					'https://www.daera-ni.gov.uk/articles/bathing-water-quality-dashboard'
			}
		});
	}
	return out;
}

// ---- Index assembly ----------------------------------------------------

async function fileExists(path) {
	try {
		await stat(path);
		return true;
	} catch {
		return false;
	}
}

async function loadCache() {
	if (!(await fileExists(cacheFile))) return null;
	try {
		return JSON.parse(await readFile(cacheFile, 'utf8'));
	} catch {
		return null;
	}
}

async function buildIndex() {
	if (CACHE_ONLY) {
		const cached = await loadCache();
		if (!cached) throw new Error('CACHE_ONLY=1 but no cache file present');
		return cached;
	}

	const fetchers = [
		['England (EA)', fetchEngland],
		['Wales (NRW)', fetchWales],
		['Scotland (SEPA)', fetchScotland],
		['Northern Ireland (DAERA)', fetchNorthernIreland]
	];

	const results = await Promise.allSettled(fetchers.map(([label, fn]) => withBudget(label, fn)));

	// Assemble in fetcher order regardless of fresh-or-cached source. Slug
	// deduplication is order-sensitive: keeping each country's rows in one
	// contiguous block preserves cross-country slug assignment, so a backfilled
	// build produces the same URLs as a full live build. (Backfilled rows arrive
	// in the cache's alphabetical order, so two same-country sites colliding on a
	// base slug could in theory take different numeric suffixes; the data has no
	// such collisions today.)
	const collected = [];
	const failures = [];
	let cache = null;
	for (let i = 0; i < results.length; i += 1) {
		const [label] = fetchers[i];
		const r = results[i];
		if (r.status === 'fulfilled') {
			console.log(`[build-location-index] ${label}: ${r.value.length} sites`);
			collected.push(...r.value);
			continue;
		}

		console.warn(`[build-location-index] ${label} failed: ${r.reason}`);
		failures.push(label);
		if (!cache) cache = await loadCache();
		const country = FETCHER_COUNTRY[label];
		const backfill = cache?.locations?.filter((l) => l.country === country) ?? [];
		if (backfill.length === 0) {
			throw new Error(`build refused: ${label} unreachable and cache holds no ${country} records`);
		}
		console.warn(
			`[build-location-index] ${label} backfilled from cache: ${backfill.length} ${country} records`
		);
		collected.push(...backfill);
	}

	dedupeSlugs(collected);
	// After dedupe, so the override is keyed by the slug the site actually
	// ships, and before the sort, so the catalogue orders by the displayed name.
	applyDisplayNames(collected);
	collected.sort((a, b) => a.name.localeCompare(b.name, 'en-GB'));

	const byCountry = {
		England: 0,
		Wales: 0,
		Scotland: 0,
		'Northern Ireland': 0
	};
	for (const loc of collected) byCountry[loc.country] = (byCountry[loc.country] ?? 0) + 1;

	return {
		generatedAt: new Date().toISOString(),
		count: collected.length,
		partialFor: failures,
		byCountry,
		locations: collected
	};
}

async function main() {
	const index = await buildIndex();
	await mkdir(dirname(outFile), { recursive: true });
	const json = `${JSON.stringify(index, null, 2)}\n`;
	await writeFile(outFile, json);
	await writeFile(cacheFile, json);

	// Ship a slim client-friendly search index alongside the full one. The
	// client only needs slug, name, country, region, classification and a
	// coarse lat/lon for nearest-beach lookup.
	const slimFile = resolve(repoRoot, 'src', 'data', 'search-index.json');
	const slim = {
		generatedAt: index.generatedAt,
		count: index.count,
		locations: index.locations.map((l) => ({
			id: l.id,
			slug: l.slug,
			name: l.name,
			officialName: l.officialName,
			country: l.country,
			region: l.region,
			classification: l.classification,
			lat: Math.round(l.lat * 1e4) / 1e4,
			lon: Math.round(l.lon * 1e4) / 1e4
		}))
	};
	await writeFile(slimFile, `${JSON.stringify(slim)}\n`);

	console.log(
		`[build-location-index] wrote ${index.count} locations to ${outFile} (${Object.entries(
			index.byCountry
		)
			.map(([k, v]) => `${k}: ${v}`)
			.join(', ')})`
	);
}

main().catch((err) => {
	console.error('[build-location-index] fatal:', err);
	process.exit(1);
});
