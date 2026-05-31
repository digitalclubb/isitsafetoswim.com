import { normalisePostcode } from '$lib/data/postcode';
import { findNearestSlim } from '$lib/data/search-index';
import type { PageLoad } from './$types';

export const prerender = false;

const NEAR_LIMIT = 12;

interface Origin {
	label: string;
	lat: number;
	lon: number;
}

async function resolvePostcode(
	code: string,
	fetch: typeof globalThis.fetch
): Promise<Origin | null> {
	const read = (result: unknown, label: (r: Record<string, unknown>) => string): Origin | null => {
		if (!result || typeof result !== 'object') return null;
		const r = result as Record<string, unknown>;
		if (typeof r.latitude !== 'number' || typeof r.longitude !== 'number') return null;
		return { label: label(r), lat: r.latitude, lon: r.longitude };
	};
	// A full postcode that is terminated returns 200 with null coordinates, so fall
	// back to its outward code rather than reporting it as not found.
	const outwardCode = code.replace(/\d[A-Z]{2}$/, '');
	try {
		const full = await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(code)}`);
		if (full.ok) {
			const { result } = await full.json();
			const origin = read(result, (r) => String(r.postcode ?? code));
			if (origin) return origin;
		}
		const outward = await fetch(
			`https://api.postcodes.io/outcodes/${encodeURIComponent(outwardCode)}`
		);
		if (outward.ok) {
			const { result } = await outward.json();
			return read(result, (r) => String(r.outcode ?? outwardCode));
		}
	} catch {
		return null;
	}
	return null;
}

export const load: PageLoad = async ({ params, fetch, setHeaders }) => {
	const code = normalisePostcode(params.postcode);
	if (!code) {
		// Deterministic garbage slug: cache it so crawlers do not re-invoke the function.
		setHeaders({ 'cache-control': 'public, s-maxage=3600' });
		return {
			code: params.postcode,
			heading: params.postcode,
			results: [],
			emptyMessage: `"${params.postcode}" does not look like a UK postcode.`
		};
	}

	const origin = await resolvePostcode(code, fetch);
	if (!origin) {
		// Could be a genuine miss or a transient postcodes.io issue, so cache briefly.
		setHeaders({ 'cache-control': 'public, s-maxage=300' });
		return {
			code,
			heading: code,
			results: [],
			emptyMessage: `We could not find the postcode ${code}.`
		};
	}

	setHeaders({ 'cache-control': 'public, s-maxage=86400, stale-while-revalidate=604800' });
	return {
		code,
		heading: origin.label,
		results: findNearestSlim({ lat: origin.lat, lon: origin.lon }, NEAR_LIMIT)
	};
};
