import type { Verdict } from '$lib/data/types';
import type { MapColours, RainfallBlob } from './types';

/**
 * Fold per-beach verdicts into the compact blob the map reads. Kept pure and
 * separate from the input gathering so the assembly is unit-testable without
 * any network. The gathering orchestration (batch fetch plus the verdict
 * engine) builds the verdict list this consumes.
 */
export function assembleColours(
	verdicts: ReadonlyArray<{ id: string; verdict: Verdict }>,
	generatedAt: string
): MapColours {
	const colours: Record<string, Verdict> = {};
	for (const { id, verdict } of verdicts) colours[id] = verdict;
	return { generatedAt, colours };
}

/**
 * Fold the batched rainfall totals into the blob the location page reads.
 * Locations with no reading are dropped rather than stored as null: absent and
 * null mean the same thing to the verdict engine, and dropping them keeps the
 * blob small. Pure, so it is unit-tested without the network.
 */
export function assembleRainfall(
	rainfall: ReadonlyMap<string, number | null>,
	generatedAt: string
): RainfallBlob {
	const totals: Record<string, number> = {};
	for (const [id, mm] of rainfall) {
		if (typeof mm === 'number' && Number.isFinite(mm)) totals[id] = mm;
	}
	return { generatedAt, rainfall: totals };
}

/**
 * Three hours, two runs of the hourly cron plus slack. Past this the blob is
 * treated as absent rather than served as today's weather: a 24h total that
 * stopped updating is not a stale nicety, it drives the HEAVY_RAIN_MM and
 * NOTICEABLE_RAIN_MM cautions, so a dead cron could otherwise pin a beach at
 * Caution long after it dried or, worse, keep saying 0mm through a storm.
 */
export const RAINFALL_MAX_AGE_MS = 3 * 60 * 60 * 1000;

/**
 * One location's 24h rainfall from the precomputed blob, or null when the blob
 * is missing, unreadable or too old to trust. The map precompute and the
 * location page both read through here so they can never disagree on the
 * figure: the invariant is that they differ only by time, never by metric.
 */
export function rainfallFrom(blob: RainfallBlob | null, id: string, now: Date): number | null {
	if (!blob) return null;
	const age = now.getTime() - Date.parse(blob.generatedAt);
	if (!Number.isFinite(age) || age > RAINFALL_MAX_AGE_MS) return null;
	return blob.rainfall[id] ?? null;
}

/**
 * Only England has usable rainfall coverage: of 701 bathing waters, 462 of
 * England's 464 have a flood-monitoring station within 15km, against 0 of 114
 * in Wales, 1 of 90 in Scotland and 0 of 33 in Northern Ireland. So a healthy
 * run covers about 66% of the catalogue, and this floor sits well below that
 * while still rejecting a batch that lost a large share of England's stations.
 */
const MIN_RAINFALL_COVERAGE = 0.4;

/**
 * Whether a freshly batched blob covers enough of the catalogue to replace the
 * stored one. The station list loading but most per-station reads failing would
 * otherwise overwrite good totals with a handful of entries, silently dropping
 * the rain signal for hundreds of beaches.
 */
export function hasUsableCoverage(blob: RainfallBlob, locationCount: number): boolean {
	return Object.keys(blob.rainfall).length >= locationCount * MIN_RAINFALL_COVERAGE;
}
