// Compile the unified UK bathing-water location index used at runtime.
//
// Data sources:
//   - England: Environment Agency Linked Data
//   - Wales:   Natural Resources Wales (same Linked Data stack)
//   - Scotland: SEPA ArcGIS MapServer
//   - Northern Ireland: DAERA ArcGIS FeatureServer
//
// All four are live JSON APIs. If the build cannot reach at least three of
// them we fall back to the previous on-disk index so a transient outage at
// one regulator never blocks a deploy, but two or more concurrent failures
// are treated as fatal. Override via env CACHE_ONLY=1 to skip the network.

import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
	classifyValue,
	dedupeSlugs,
	extractLabel,
	lastNonEmptyPathSegment,
	readSamplingPoint,
	slugify
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
		timer = setTimeout(
			() => reject(new Error(`${label} exceeded ${budgetMs}ms budget`)),
			budgetMs
		);
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
				waterType: undefined,
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
			const typeLabel = String(extractLabel(item.type) ?? '').toLowerCase();
			const waterType =
				typeLabel.includes('lake') || typeLabel.includes('river') || typeLabel.includes('inland')
					? 'inland'
					: 'coastal';
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
				waterType,
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

	const results = await Promise.allSettled(
		fetchers.map(([label, fn]) => withBudget(label, fn))
	);

	const collected = [];
	const failures = [];
	for (let i = 0; i < results.length; i += 1) {
		const [label] = fetchers[i];
		const r = results[i];
		if (r.status === 'fulfilled') {
			console.log(`[build-location-index] ${label}: ${r.value.length} sites`);
			collected.push(...r.value);
		} else {
			console.warn(`[build-location-index] ${label} failed: ${r.reason}`);
			failures.push(label);
		}
	}

	if (failures.length === fetchers.length) {
		console.warn('[build-location-index] all fetchers failed, falling back to cache');
		const cached = await loadCache();
		if (cached) return cached;
		throw new Error('all fetchers failed and no cache available');
	}

	if (failures.length >= 2) {
		throw new Error(
			`build refused: ${failures.length} regulators failed (${failures.join(', ')})`
		);
	}

	if (failures.length > 0) {
		console.warn(`[build-location-index] partial build, missing: ${failures.join(', ')}`);
	}

	dedupeSlugs(collected);
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
