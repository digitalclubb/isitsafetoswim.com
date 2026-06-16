import { describe, expect, it, vi } from 'vitest';
import type { Location } from '$lib/data/types';
import { fetchJson } from './http';
import { fetchRainfallByLocation, nearestStation, sumRainfall } from './rainfall';

vi.mock('./http', () => ({ fetchJson: vi.fn() }));

describe('sumRainfall', () => {
	it('returns null for no readings', () => {
		expect(sumRainfall([])).toBeNull();
	});

	it('returns null when no reading has a numeric value', () => {
		expect(sumRainfall([{ value: undefined }, {}])).toBeNull();
	});

	it('sums positive tips and rounds to one decimal', () => {
		expect(sumRainfall([{ value: 0.2 }, { value: 0 }, { value: 0.3 }])).toBe(0.5);
	});

	it('counts a true zero as a reading, returning 0 not null', () => {
		expect(sumRainfall([{ value: 0 }])).toBe(0);
	});
});

describe('nearestStation', () => {
	const stations = [
		{ ref: 'near', lat: 51.51, lon: -0.1 },
		{ ref: 'far', lat: 52.5, lon: -0.1 }
	];

	it('returns the closest station within range', () => {
		const s = nearestStation(stations, { lat: 51.5, lon: -0.1 });
		expect(s?.ref).toBe('near');
	});

	it('returns null when the nearest station is beyond the radius', () => {
		const s = nearestStation([{ ref: 'far', lat: 52.5, lon: -0.1 }], { lat: 51.5, lon: -0.1 });
		expect(s).toBeNull();
	});

	it('returns null for no stations', () => {
		expect(nearestStation([], { lat: 51.5, lon: -0.1 })).toBeNull();
	});
});

function loc(id: string, lat: number, lon: number): Location {
	return { id, lat, lon } as unknown as Location;
}

describe('fetchRainfallByLocation', () => {
	it('reads each unique station once and maps beaches to the nearest', async () => {
		vi.mocked(fetchJson).mockImplementation(async (url: string) => {
			if (url.includes('/id/stations?parameter=rainfall&_limit=10000')) {
				return {
					items: [
						{ stationReference: 'S1', lat: 51.5, long: -0.1 },
						{ stationReference: 'S2', lat: 55.0, long: -1.0 }
					]
				};
			}
			if (url.includes('/stations/S1/readings')) return { items: [{ value: 0.4 }, { value: 0.1 }] };
			return { items: [] };
		});

		const locations = [loc('a', 51.5, -0.1), loc('b', 51.51, -0.1), loc('c', 53.0, -0.5)];
		const map = await fetchRainfallByLocation(locations);

		// a and b share the nearest station S1 (0.5mm); c is out of range -> null.
		expect(map.get('a')).toBe(0.5);
		expect(map.get('b')).toBe(0.5);
		expect(map.get('c')).toBeNull();
		// One station list call plus one readings call for the shared S1 only.
		expect(fetchJson).toHaveBeenCalledTimes(2);
	});

	it('returns all null when the station list cannot be fetched', async () => {
		vi.mocked(fetchJson).mockRejectedValue(new Error('down'));
		const map = await fetchRainfallByLocation([loc('a', 51.5, -0.1)]);
		expect(map.get('a')).toBeNull();
	});
});
