import type { Location, TideEvent, TideInfo } from '$lib/data/types';
import { fetchJson } from './http';

/**
 * Tide state from the Open-Meteo Marine API (open, no key, CC-BY), the same
 * host already used for sea temperature. It returns an hourly sea-level curve
 * relative to mean sea level rather than a table of tide times, so high and low
 * water are derived here from the turning points of that curve.
 *
 * This is a model, not an Admiralty prediction, and it is not accurate enough
 * to publish as a tide table. Checked against Environment Agency tide gauges on
 * three coasts in September 2026, the modelled turning point ran 20 to 60
 * minutes ahead of the observed one:
 *
 *   Newhaven       observed 14:45 / 03:15   modelled 14:17 / 02:46
 *   Plymouth       observed 09:00 / 21:45   modelled 08:26 / 20:42
 *   Kinlochbervie  observed 11:00 / 23:15   modelled 10:26 / 22:56
 *
 * Some of that is real: the grid cell sits offshore and a harbour genuinely
 * lags the open coast. The rest is model error. Either way the honest product
 * is the state of the tide and roughly when it turns, not a time to the minute,
 * so `roundToTenMinutes` blunts the displayed precision to match and the page
 * says plainly that it can be half an hour out. The UKHO Admiralty APIs are the
 * authority, but they need a registered key and their predictions cannot be
 * republished, so the page links out to EasyTide instead.
 *
 * It is a swimming cue, never a navigational one, and never an input to the
 * water-quality verdict.
 *
 * Rivers and lakes are not on the marine grid, which returns nulls for them,
 * so inland sites skip the call entirely.
 */
const MARINE_ENDPOINT = 'https://marine-api.open-meteo.com/v1/marine';

/**
 * A semidiurnal tide turns roughly every 6h12m, so an hourly series brackets
 * every turning point but lands on it only by luck. Fitting a parabola through
 * the peak sample and its two neighbours recovers the turn to within a few
 * minutes, which is the difference between a useful figure and one that is
 * wrong by up to half an hour.
 */
export function refineTurningPoint(
	before: number,
	peak: number,
	after: number
): { offsetHours: number; height: number } {
	const denominator = before - 2 * peak + after;
	// A flat or straight run has no vertex to solve for. Falling back to the
	// sampled point is right rather than dividing by zero.
	if (denominator === 0) return { offsetHours: 0, height: peak };
	const raw = (0.5 * (before - after)) / denominator;
	// A symmetric peak divides out to -0, which is the same instant but reads
	// oddly anywhere the number is surfaced or compared.
	const offsetHours = raw === 0 ? 0 : raw;
	const height = peak - 0.25 * (before - after) * offsetHours;
	return { offsetHours, height };
}

/**
 * Snap an instant to the nearest ten minutes. The underlying model is tens of
 * minutes out, so printing "17:35" claims a precision the data does not have.
 */
export function roundToTenMinutes(ms: number): number {
	const step = 10 * 60 * 1000;
	return Math.round(ms / step) * step;
}

/**
 * Turning points of an hourly sea-level series, as high and low water. Pure so
 * the interpolation and the ordering are testable without the network.
 *
 * Only points strictly higher (or lower) than both neighbours count, so a flat
 * pair at the top of the curve is skipped rather than reported twice.
 */
export function findTideEvents(times: string[], heights: Array<number | null>): TideEvent[] {
	const events: TideEvent[] = [];
	for (let i = 1; i < heights.length - 1; i += 1) {
		const before = heights[i - 1];
		const peak = heights[i];
		const after = heights[i + 1];
		if (before === null || peak === null || after === null) continue;
		const isHigh = peak > before && peak > after;
		const isLow = peak < before && peak < after;
		if (!isHigh && !isLow) continue;
		const at = Date.parse(times[i]);
		if (!Number.isFinite(at)) continue;
		const { offsetHours, height } = refineTurningPoint(before, peak, after);
		events.push({
			at: new Date(roundToTenMinutes(at + offsetHours * 36e5)).toISOString(),
			type: isHigh ? 'high' : 'low',
			heightM: Math.round(height * 100) / 100
		});
	}
	return events;
}

/**
 * Build the tide summary from a parsed series: the turning points still to come
 * and whether the water is rising or falling right now. Returns null when the
 * series carries no usable turning point, which is what an inland or off-grid
 * point produces.
 */
export function summariseTide(
	times: string[],
	heights: Array<number | null>,
	now: Date
): TideInfo | null {
	const all = findTideEvents(times, heights);
	const upcoming = all.filter((e) => Date.parse(e.at) > now.getTime());
	if (upcoming.length === 0) return null;
	// Heading for high water means the water is rising. Deriving the state from
	// the next turning point rather than from the last two samples keeps it
	// consistent with the times shown beside it.
	return {
		events: upcoming.slice(0, 4),
		state: upcoming[0].type === 'high' ? 'rising' : 'falling'
	};
}

interface MarineResponse {
	hourly?: { time?: string[]; sea_level_height_msl?: Array<number | null> };
}

export async function fetchTide(
	location: Location,
	signal?: AbortSignal,
	now: Date = new Date()
): Promise<TideInfo | null> {
	if (location.waterType === 'inland') return null;
	// Two days covers the next four turning points from any starting hour.
	// UTC throughout, so the timestamps need no timezone reasoning here; the
	// page formats them in London time like every other time on the site.
	const url =
		`${MARINE_ENDPOINT}?latitude=${location.lat.toFixed(3)}&longitude=${location.lon.toFixed(3)}` +
		`&hourly=sea_level_height_msl&timezone=UTC&forecast_days=2`;
	try {
		const body = await fetchJson<MarineResponse>(url, { signal });
		const times = body.hourly?.time ?? [];
		const heights = body.hourly?.sea_level_height_msl ?? [];
		if (times.length === 0 || times.length !== heights.length) return null;
		// Open-Meteo returns naive local strings; with timezone=UTC they are UTC,
		// so mark them as such rather than letting the runtime guess.
		return summariseTide(
			times.map((t) => (t.endsWith('Z') ? t : `${t}Z`)),
			heights,
			now
		);
	} catch {
		return null;
	}
}
