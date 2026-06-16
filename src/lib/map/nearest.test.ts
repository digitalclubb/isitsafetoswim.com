import { describe, expect, it } from 'vitest';
import type { Verdict } from '$lib/data/types';
import { nearestSafe } from './nearest';
import type { MapPoint } from './types';

function point(id: string, lat: number, lon: number): MapPoint {
	return { id, slug: id, name: id, country: 'England', lat, lon };
}

// A small cluster around London (51.5, -0.1).
const points: MapPoint[] = [
	point('here', 51.5, -0.1),
	point('near', 51.51, -0.1),
	point('mid', 51.6, -0.1),
	point('far', 52.5, -0.1)
];

const origin = { lat: 51.5, lon: -0.1 };

describe('nearestSafe', () => {
	it('returns only Yes-rated beaches, closest first', () => {
		const colours: Record<string, Verdict> = {
			here: 'yes',
			near: 'no',
			mid: 'yes',
			far: 'yes'
		};
		const result = nearestSafe(origin, points, colours);
		expect(result.map((r) => r.point.id)).toEqual(['here', 'mid', 'far']);
		expect(result[0].distanceMetres).toBeLessThan(result[1].distanceMetres);
	});

	it('excludes caution and no', () => {
		const colours: Record<string, Verdict> = { here: 'caution', near: 'no' };
		expect(nearestSafe(origin, points, colours)).toEqual([]);
	});

	it('excludes beaches absent from the colour blob (not yet computed)', () => {
		// Only `here` has a verdict; the other three are missing entirely.
		const result = nearestSafe(origin, points, { here: 'yes' });
		expect(result.map((r) => r.point.id)).toEqual(['here']);
	});

	it('caps the list at the limit', () => {
		const colours: Record<string, Verdict> = Object.fromEntries(
			points.map((p) => [p.id, 'yes' as Verdict])
		);
		expect(nearestSafe(origin, points, colours, 2)).toHaveLength(2);
	});
});
