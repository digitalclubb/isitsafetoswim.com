import type { Location, RecentSample } from '$lib/data/types';
import { fetchJson } from './http';

/**
 * Recent in-season sample history for a site, used for the trend sparkline.
 * The EA and NRW publish each sample with E. coli and intestinal enterococci
 * counts; we read the most recent dozen, newest first from the API, and return
 * them oldest first for a left-to-right trend. England and Wales sit on
 * different dataset paths; Scotland and NI have no per-site sample feed, so
 * they return an empty history.
 */
const HISTORY_LIMIT = 12;

const SAMPLE_ENDPOINT: Record<'ea' | 'nrw', string> = {
	ea: 'https://environment.data.gov.uk/doc/bathing-water-quality/in-season/sample.json',
	nrw: 'https://environment.data.gov.uk/wales/bathing-waters/doc/bathing-water-quality/in-season/sample.json'
};

interface SampleItem {
	sampleDateTime?: unknown;
	escherichiaColiCount?: unknown;
	intestinalEnterococciCount?: unknown;
}

function num(value: unknown): number | undefined {
	if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
	if (value && typeof value === 'object' && '_value' in value)
		return num((value as { _value: unknown })._value);
	if (typeof value === 'string') {
		const n = Number(value);
		return Number.isFinite(n) ? n : undefined;
	}
	return undefined;
}

/** sampleDateTime is a gregorian-instant URI whose tail is the ISO timestamp. */
function instantToIso(value: unknown): string | undefined {
	const raw =
		typeof value === 'string'
			? value
			: value && typeof value === 'object' && '_value' in value
				? String((value as { _value: unknown })._value)
				: '';
	const tail = raw.split('/').pop() ?? '';
	return Number.isFinite(Date.parse(tail)) ? tail : undefined;
}

/** Pure: parse the sample-list payload into oldest-first samples. */
export function parseSampleHistory(payload: unknown): RecentSample[] {
	const items = (payload as { result?: { items?: SampleItem[] } }).result?.items ?? [];
	const out: RecentSample[] = [];
	for (const item of items) {
		const sampledAt = instantToIso(item.sampleDateTime);
		if (!sampledAt) continue;
		const eColi = num(item.escherichiaColiCount);
		const intestinalEnterococci = num(item.intestinalEnterococciCount);
		if (eColi === undefined && intestinalEnterococci === undefined) continue;
		out.push({ sampledAt, eColi, intestinalEnterococci });
	}
	// The API returns newest first; reverse to oldest first for the trend.
	return out.reverse();
}

export async function fetchSampleHistory(
	location: Location,
	signal?: AbortSignal
): Promise<RecentSample[]> {
	const api = location.source.api;
	if (api !== 'ea' && api !== 'nrw') return [];
	const url =
		`${SAMPLE_ENDPOINT[api]}?bwq_bathingWater.eubwidNotation=${encodeURIComponent(location.source.sourceId)}` +
		`&_view=all&_sort=-sampleDateTime&_pageSize=${HISTORY_LIMIT}`;
	try {
		return parseSampleHistory(await fetchJson<unknown>(url, { signal }));
	} catch {
		return [];
	}
}
