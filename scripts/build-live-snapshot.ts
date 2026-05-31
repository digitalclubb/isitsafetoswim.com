/**
 * Builds the live snapshot of profile (classification, latest sample, daily
 * risk forecast) and 24h rainfall for every bathing water, then uploads it to
 * Vercel Blob as live/snapshot.json. The serverless function reads that blob at
 * request time because environment.data.gov.uk 403s Vercel's egress IPs but is
 * reachable from this runner. Discharges are not snapshotted, they are fetched
 * live from the ArcGIS feeds which Vercel can reach.
 *
 * Classification and the daily risk forecast come from one bulk list request
 * per country, so the data that clears the "live data unavailable" state is
 * never rate-limited. The latest sample and 24h rainfall are per-site and the
 * regulator host rate-limits sustained bursts, so they are fetched politely
 * (low concurrency, retry with backoff) and treated as best-effort: a site that
 * 403s keeps a null sample or rainfall and recovers on the next hourly run.
 *
 * Run with tsx. `pnpm data:snapshot` uploads; `--dry-run` writes the snapshot to
 * scripts/.live-snapshot.json and skips the upload (no blob token required).
 *
 * Reuses the same fetchers as the runtime so the EA/NRW JSON parsing never
 * forks: scripts/build-live-snapshot.ts <-> src/lib/live/{profile,rainfall}.ts
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { Location, LocationIndex } from '../src/lib/data/types';
import {
	type BulkProfileEntry,
	dereferenceSample,
	fetchProfileList
} from '../src/lib/live/profile';
import { fetchRainfall24h } from '../src/lib/live/rainfall';
import type { LiveSnapshot, SnapshotEntry } from '../src/lib/live/snapshot';

const CONCURRENCY = 5;
const RETRIES = 2;
const dryRun = process.argv.includes('--dry-run');

const root = fileURLToPath(new URL('..', import.meta.url));
const index = JSON.parse(readFileSync(`${root}src/data/locations.json`, 'utf8')) as LocationIndex;
const locations = index.locations;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Best-effort with exponential backoff. Returns null rather than throwing. */
async function attempt<T>(fn: () => Promise<T>): Promise<T | null> {
	for (let i = 0; i <= RETRIES; i++) {
		try {
			return await fn();
		} catch {
			if (i === RETRIES) return null;
			await sleep(400 * 2 ** i + Math.floor(Math.random() * 200));
		}
	}
	return null;
}

async function snapshotSite(
	location: Location,
	bulk: BulkProfileEntry | undefined
): Promise<SnapshotEntry> {
	const isRegulatorApi = location.source.api === 'ea' || location.source.api === 'nrw';
	// Scotland and Northern Ireland have no per-site live API, so the index
	// classification stands in and the profile counts as ok, mirroring fetchProfile.
	const ok = isRegulatorApi ? bulk !== undefined : true;
	const classification = isRegulatorApi
		? (bulk?.classification ?? null)
		: location.classification === 'Unknown'
			? null
			: location.classification;

	const latestSample = bulk?.sampleUri
		? await attempt(() => dereferenceSample(bulk.sampleUri as string, undefined))
		: null;
	const rainfall24hMm = await attempt(() =>
		fetchRainfall24h({ lat: location.lat, lon: location.lon })
	);

	return {
		ok,
		classification,
		latestSample: latestSample ?? null,
		riskForecast: bulk?.riskForecast ?? null,
		rainfall24hMm: rainfall24hMm ?? null
	};
}

async function run(): Promise<void> {
	console.log('Fetching bulk profiles (England + Wales)...');
	const [ea, nrw] = await Promise.all([
		attempt(() => fetchProfileList('ea')),
		attempt(() => fetchProfileList('nrw'))
	]);
	// England and Wales share the environment.data.gov.uk host, so a list failure
	// is normally both or neither. Abort the whole run rather than upload a
	// partial: a no-upload leaves the previous good blob in place for both
	// countries, which the runtime keeps serving, instead of degrading one.
	if (!ea || !nrw) {
		throw new Error(`bulk profile list failed (ea=${!!ea} nrw=${!!nrw})`);
	}
	const bulk = new Map<string, BulkProfileEntry>([...ea, ...nrw]);
	console.log(`  ${ea.size} England + ${nrw.size} Wales profiles.`);

	const sites: Record<string, SnapshotEntry> = {};
	let done = 0;
	let okCount = 0;

	const queue = [...locations];
	async function worker(): Promise<void> {
		for (let next = queue.shift(); next !== undefined; next = queue.shift()) {
			const entry = await snapshotSite(next, bulk.get(next.source.sourceId));
			sites[next.id] = entry;
			done += 1;
			if (entry.ok) okCount += 1;
			if (done % 100 === 0) console.log(`  ${done}/${locations.length}`);
		}
	}
	await Promise.all(Array.from({ length: CONCURRENCY }, worker));

	const withSample = Object.values(sites).filter((s) => s.latestSample).length;
	const withRain = Object.values(sites).filter((s) => s.rainfall24hMm !== null).length;
	const snapshot: LiveSnapshot = { generatedAt: new Date().toISOString(), sites };
	console.log(
		`Snapshotted ${done} sites: ${okCount} with a profile, ${withSample} with a sample, ${withRain} with rainfall.`
	);

	if (dryRun) {
		const out = `${root}scripts/.live-snapshot.json`;
		writeFileSync(out, JSON.stringify(snapshot));
		console.log(`Dry run: wrote ${out}`);
		return;
	}

	const { put } = await import('@vercel/blob');
	const blob = await put('live/snapshot.json', JSON.stringify(snapshot), {
		access: 'public',
		addRandomSuffix: false,
		contentType: 'application/json',
		allowOverwrite: true,
		cacheControlMaxAge: 300
	});
	console.log(`Uploaded snapshot to ${blob.url}`);
}

run().catch((err) => {
	console.error(err);
	process.exit(1);
});
