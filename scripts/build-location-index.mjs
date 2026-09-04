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
	waterTypeFromEaType,
	yearFromComplianceUri
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

// The key OVERFLOW_ENDPOINTS in src/lib/live/discharges.ts maps to the live
// Welsh Water storm-overflow feed. Spelled exactly as the EA spells it for the
// English rows so one lookup table serves both.
const WELSH_UNDERTAKER = 'Dwr Cymru Cyfyngedig';

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
				classificationYear: yearFromComplianceUri(item.latestComplianceAssessment?._about),
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
				classificationYear: yearFromComplianceUri(item.latestComplianceAssessment?._about),
				// NRW publishes no appointed-undertaker field, but Dwr Cymru is the
				// sewerage undertaker for effectively all of Wales, and it is the key
				// that resolves the live storm-overflow feed. Without it every Welsh
				// site reported "no feed" while a working feed sat unused. The small
				// Hafren Dyfrdwy border area is not separated out: the feed's own
				// ten-kilometre distance filter decides what is actually nearby.
				sewerageUndertaker: WELSH_UNDERTAKER,
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

// ---- Scottish council areas --------------------------------------------

// SEPA's feed carries no district, so every Scottish bathing water rolled up to
// one country page and Scotland had no regional hubs at all, against 29 for
// England. The coordinates are there, so the council area is a reverse lookup
// rather than missing data. postcodes.io is the same open service the site
// already uses for postcode entry, and one POST covers the whole country.
const POSTCODES_BULK = 'https://api.postcodes.io/postcodes';

// A bathing water sits on the coast, so its nearest postcode is inland of it and
// a little way off. Measured over all 90 Scottish sites the worst genuine match
// is 673m, so a 2km search is already three times looser than the data needs. It
// is deliberately not wider: a site at an estuary mouth can find its nearest
// postcode across the water in the wrong council, and both the Forth and the
// Clyde are under 5km across in places.
const POSTCODE_SEARCH_RADIUS_M = 2_000;

// postcodes.io rejects a bulk request of more than 100 geolocations. Scotland
// sits at 90, so a handful of new designations would 400 the whole POST and
// silently drop every Scottish region, deleting eight hub pages and their URLs
// on the next build.
const POSTCODE_BULK_LIMIT = 100;

function chunk(items, size) {
	const out = [];
	for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
	return out;
}

async function addScottishRegions(locations) {
	const rows = locations.filter((l) => l.country === COUNTRY.SCOTLAND);
	if (rows.length === 0) return;
	try {
		const bodies = await withBudget('Scotland council areas', () =>
			Promise.all(
				chunk(rows, POSTCODE_BULK_LIMIT).map((batch) =>
					fetchJson(POSTCODES_BULK, {
						method: 'POST',
						headers: { 'content-type': 'application/json' },
						body: JSON.stringify({
							geolocations: batch.map((l) => ({
								latitude: l.lat,
								longitude: l.lon,
								limit: 1,
								radius: POSTCODE_SEARCH_RADIUS_M
							}))
						})
					})
				)
			)
		);
		const results = bodies.flatMap((body) => body.result ?? []);
		let named = 0;
		rows.forEach((row, i) => {
			const nearest = results[i]?.result?.[0];
			if (!nearest) return;
			const district = nearest.admin_district;
			if (typeof district !== 'string' || !district.trim()) return;
			// Belt and braces behind the search radius, written so a response
			// carrying no distance at all is refused rather than waved through by
			// Number(undefined) > radius evaluating false.
			const distance = Number(nearest.distance);
			if (!Number.isFinite(distance) || distance > POSTCODE_SEARCH_RADIUS_M) return;
			row.region = district.trim();
			named += 1;
		});
		console.log(
			`[build-location-index] Scotland: ${named} of ${rows.length} sites given a council area`
		);
		if (named < rows.length) {
			console.warn(
				`[build-location-index] Scotland: ${rows.length - named} sites have no council area, so their region hubs will not build`
			);
		}
	} catch (err) {
		// Regions decide which hub pages exist, not whether a beach is safe, so a
		// lookup failure leaves Scotland as it was rather than failing the build.
		// Loud, because it silently removes live pages.
		console.warn(
			`[build-location-index] Scottish council areas unavailable, every Scottish region hub will be missing: ${err.message}`
		);
	}
}

// ---- Previous classification -------------------------------------------

// Both regulators date an assessment only inside its own URI, and neither
// serves last year's rating alongside this year's. One filtered query per
// country covers the whole catalogue, which is what makes "up from Good" a
// build-time fact rather than 578 extra per-site requests.
const COMPLIANCE_BASES = {
	[COUNTRY.ENGLAND]:
		'https://environment.data.gov.uk/doc/bathing-water-quality/compliance-rBWD.json',
	[COUNTRY.WALES]:
		'https://environment.data.gov.uk/wales/bathing-waters/doc/bathing-water-quality/compliance-rBWD.json'
};

async function fetchComplianceYear(base, year) {
	const bySourceId = new Map();
	for (let page = 0; page < MAX_PAGES; page += 1) {
		const url = `${base}?sampleYear.ordinalYear=${year}&_pageSize=${PAGE_SIZE}&_page=${page}`;
		const body = await fetchJson(url);
		const items = body.result?.items ?? [];
		if (items.length === 0) break;
		for (const item of items) {
			const sourceId = item.bwq_bathingWater?.eubwidNotation;
			const classification = classifyValue(
				extractLabel(item.complianceClassification?.name) ?? extractLabel(item.complianceClassification)
			);
			if (!sourceId || !classification || classification === 'Unknown') continue;
			bySourceId.set(sourceId, classification);
		}
		if (!body.result?.next) break;
	}
	return bySourceId;
}

/**
 * Stamp each England and Wales row with the classification it held the season
 * before, so the page can say a rating went up or down rather than only what it
 * is now. Best-effort: a failure leaves the field unset and the page simply
 * says nothing about the change, which is why it never aborts the build.
 */
async function addPreviousClassifications(locations) {
	for (const [country, base] of Object.entries(COMPLIANCE_BASES)) {
		const rows = locations.filter((l) => l.country === country && l.classificationYear);
		if (rows.length === 0) continue;
		// Take the newest year present rather than an assumed one, so the build
		// follows the regulator through the November publication automatically.
		const latest = Math.max(...rows.map((l) => l.classificationYear));
		try {
			const previous = await withBudget(`${country} compliance ${latest - 1}`, () =>
				fetchComplianceYear(base, latest - 1)
			);
			let stamped = 0;
			for (const row of rows) {
				if (row.classificationYear !== latest) continue;
				const was = previous.get(row.source.sourceId);
				if (!was) continue;
				row.previousClassification = was;
				stamped += 1;
			}
			console.log(
				`[build-location-index] ${country}: ${stamped} rows carry their ${latest - 1} classification`
			);
		} catch (err) {
			console.warn(
				`[build-location-index] ${country} previous classification unavailable: ${err.message}`
			);
		}
	}
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
			classificationYear: Number.isFinite(Number(props.year)) ? Number(props.year) : undefined,
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

/**
 * DAERA's weekly water-quality indicator, on its own three-value vocabulary.
 * `NoBathing` is advice against bathing rather than a rating, so it is kept
 * distinct from the two clean readings; the verdict engine turns it into a No.
 * An unrecognised value returns null rather than guessing, because every one of
 * these values ends up as a safety claim on a page.
 */
function readNiAssessment(props) {
	const raw = props.water_quality_indicator ?? props.Water_Quality_Indicator;
	if (typeof raw !== 'string') return undefined;
	const lower = raw.toLowerCase().replace(/[^a-z]/g, '');
	const level =
		lower === 'nobathing'
			? 'advised-against'
			: lower === 'excellent'
				? 'good'
				: lower === 'satisfactory'
					? 'satisfactory'
					: null;
	if (!level) {
		// The exact shape of the bug this function exists to fix: classifyValue
		// swallowing `NoBathing` is what turned advice against bathing into an
		// unclassified site. A new DAERA word must surface at build time, not as a
		// quietly neutral page.
		console.warn(
			`[build-location-index] unrecognised DAERA water_quality_indicator: ${JSON.stringify(raw)}`
		);
		return undefined;
	}
	const at = Number(props.Sampling_datetime);
	return {
		level,
		// DAERA's own word, so the page reports "Excellent" where DAERA said
		// Excellent rather than flattening it to this file's internal level.
		label: level === 'advised-against' ? 'Advised against bathing' : raw.trim(),
		assessedAt: Number.isFinite(at) && at > 0 ? new Date(at).toISOString() : undefined
	};
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
			// DAERA publishes no annual classification. `water_quality_indicator` is
			// a weekly judgement taken from that week's sample, on its own
			// vocabulary (Excellent / Satisfactory / NoBathing), so reading it into
			// `classification` claimed a four-year percentile that does not exist
			// and lost the NoBathing sites to the parser's catch-all.
			classification: 'Unknown',
			currentAssessment: readNiAssessment(props),
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

	// Best-effort and after the backfill, so rows restored from cache keep the
	// previous classification and council area they were built with when a host
	// is unreachable.
	await Promise.all([addPreviousClassifications(collected), addScottishRegions(collected)]);

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
	// coarse lat/lon for nearest-beach lookup, plus the regulator's own reading
	// where no classification exists: without it every Northern Irish card in a
	// nearby or postcode result reads "Unclassified", which is the gap this
	// build stopped papering over rather than a thing to reintroduce.
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
			currentAssessment: l.currentAssessment,
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
