import { env } from '$env/dynamic/private';
import type { Classification, RecentSample, RiskForecast } from '$lib/data/types';

/**
 * A pre-fetched profile + rainfall reading for one site. The regulator host
 * (environment.data.gov.uk) 403s Vercel's egress IPs, so these fields cannot be
 * fetched from the serverless function at request time. A scheduled job on a
 * non-blocked runner snapshots them instead and the function reads the snapshot.
 * See scripts/build-live-snapshot.ts and .github/workflows/live-snapshot.yml.
 */
export interface SnapshotEntry {
	ok: boolean;
	classification: Classification | null;
	latestSample: RecentSample | null;
	riskForecast: RiskForecast | null;
	rainfall24hMm: number | null;
}

export interface LiveSnapshot {
	generatedAt: string;
	sites: Record<string, SnapshotEntry>;
}

const TTL_MS = 60_000;
const FETCH_TIMEOUT_MS = 8_000;
let cache: { at: number; snapshot: LiveSnapshot } | null = null;
let inflight: Promise<LiveSnapshot | null> | null = null;

function isSnapshot(value: unknown): value is LiveSnapshot {
	if (typeof value !== 'object' || value === null) return false;
	const sites = (value as LiveSnapshot).sites;
	return typeof sites === 'object' && sites !== null;
}

/**
 * Load the live snapshot, served from the public blob URL in LIVE_SNAPSHOT_URL.
 * Returns null when the variable is unset (local dev, or before the first cron
 * run) so the caller can fall back to fetching the regulator directly. Holds a
 * 60s in-memory cache and keeps serving the last good snapshot if a refresh
 * fails, so a transient blob outage never blanks the verdict.
 *
 * The load is a process-level singleton with its own timeout, deliberately not
 * tied to any caller's request signal: a single client disconnecting must not
 * abort the shared fetch and blank every other concurrent verdict.
 */
export async function loadSnapshot(): Promise<LiveSnapshot | null> {
	const url = env.LIVE_SNAPSHOT_URL;
	if (!url) return null;

	if (cache && Date.now() - cache.at < TTL_MS) return cache.snapshot;
	if (inflight) return inflight;

	inflight = (async () => {
		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
		try {
			const res = await fetch(url, { signal: controller.signal });
			if (!res.ok) throw new Error(`snapshot HTTP ${res.status}`);
			const data: unknown = await res.json();
			if (!isSnapshot(data)) throw new Error('snapshot shape invalid');
			cache = { at: Date.now(), snapshot: data };
			return data;
		} catch {
			// Serve the last good snapshot if we have one. Leave the cache untouched
			// so a cold-start failure retries on the next call rather than serving
			// null for a full TTL.
			return cache?.snapshot ?? null;
		} finally {
			clearTimeout(timer);
			inflight = null;
		}
	})();
	return inflight;
}
