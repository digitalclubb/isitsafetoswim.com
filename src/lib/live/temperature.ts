import type { Location } from '$lib/data/types';
import { fetchJson } from './http';

/**
 * Sea-surface temperature from the Open-Meteo Marine API (open, no key). Used as
 * a cold-water-shock safety cue, not as a pollution-verdict input. Rivers and
 * lakes are not on the marine grid (it returns null for them), so inland sites
 * skip the call entirely. Fails closed to null so it never blocks the verdict.
 */
const MARINE_ENDPOINT = 'https://marine-api.open-meteo.com/v1/marine';

export async function fetchSeaTemperature(
	location: Location,
	signal?: AbortSignal
): Promise<number | null> {
	if (location.waterType === 'inland') return null;
	const url =
		`${MARINE_ENDPOINT}?latitude=${location.lat.toFixed(3)}&longitude=${location.lon.toFixed(3)}` +
		`&current=sea_surface_temperature`;
	try {
		const body = await fetchJson<{ current?: { sea_surface_temperature?: number | null } }>(url, {
			signal
		});
		const t = body.current?.sea_surface_temperature;
		return typeof t === 'number' && Number.isFinite(t) ? Math.round(t * 10) / 10 : null;
	} catch {
		return null;
	}
}

export interface TemperatureBand {
	label: string;
	tone: 'yes' | 'caution' | 'no' | 'neutral';
	note?: string;
}

/**
 * Band a sea temperature for cold-water-shock guidance. Cold-water shock risk is
 * pronounced below about 15°C, so those bands carry a safety note.
 */
export function seaTemperatureBand(celsius: number): TemperatureBand {
	if (celsius < 12) {
		return {
			label: 'Very cold',
			tone: 'no',
			note: 'High cold-water shock risk. Acclimatise slowly or stay out.'
		};
	}
	if (celsius < 15) {
		return {
			label: 'Cold',
			tone: 'caution',
			note: 'Cold-water shock risk. Enter slowly and do not swim alone.'
		};
	}
	if (celsius < 18) return { label: 'Cool', tone: 'neutral' };
	if (celsius < 21) return { label: 'Mild', tone: 'yes' };
	return { label: 'Warm', tone: 'yes' };
}
