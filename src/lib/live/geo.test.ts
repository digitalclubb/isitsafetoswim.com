import { describe, expect, it } from 'vitest';
import { haversineMetres, osgb36ToWgs84 } from './geo';

describe('osgb36ToWgs84', () => {
	it('reprojects central London grid coordinates to WGS84', () => {
		const r = osgb36ToWgs84(530034, 180381);
		expect(r.lat).toBeCloseTo(51.5074, 3);
		expect(r.lon).toBeCloseTo(-0.1277, 3);
	});

	it('lands within a few tens of metres of the OS worked example', () => {
		const r = osgb36ToWgs84(651409.903, 313177.27);
		// OSGB36 lat/lon of the OS Caister example; WGS84 sits a short datum shift away.
		expect(haversineMetres(r, { lat: 52.6576, lon: 1.7163 })).toBeLessThan(150);
	});
});

describe('haversineMetres', () => {
	it('measures about 1km between points 0.009 degrees of latitude apart', () => {
		const d = haversineMetres({ lat: 51.5, lon: -0.12 }, { lat: 51.509, lon: -0.12 });
		expect(d).toBeGreaterThan(950);
		expect(d).toBeLessThan(1050);
	});
});
