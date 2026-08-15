import { describe, expect, it } from 'vitest';
import {
	eastingNorthingToWgs84,
	gridRefToEastingNorthing,
	gridRefToWgs84,
	haversineMetres
} from './ngr.mjs';

describe('gridRefToEastingNorthing', () => {
	// The square origins are fixed by the grid, so these are exact, not approximate.
	it('resolves the worked example from the OS coordinate systems guide', () => {
		expect(gridRefToEastingNorthing('TG5140013177')).toEqual({
			easting: 651400,
			northing: 313177
		});
	});

	it('places the four corner squares of the grid', () => {
		// SV is the south-west origin square, so its corner is the grid origin.
		expect(gridRefToEastingNorthing('SV0000000000')).toEqual({ easting: 0, northing: 0 });
		expect(gridRefToEastingNorthing('NA0000000000')).toEqual({ easting: 0, northing: 900000 });
		expect(gridRefToEastingNorthing('TV0000000000')).toEqual({ easting: 500000, northing: 0 });
		expect(gridRefToEastingNorthing('HP0000000000')).toEqual({ easting: 400000, northing: 1200000 });
	});

	// A coarser reference names a larger square, and the convention is to take
	// its south-west corner rather than its centre.
	it('pads a short reference to the south-west corner of its square', () => {
		expect(gridRefToEastingNorthing('SP64')).toEqual({ easting: 460000, northing: 240000 });
		expect(gridRefToEastingNorthing('SP6404')).toEqual({ easting: 464000, northing: 204000 });
		expect(gridRefToEastingNorthing('SP6419046470')).toEqual({ easting: 464190, northing: 246470 });
	});

	it('ignores whitespace and case', () => {
		expect(gridRefToEastingNorthing('tg 51400 13177')).toEqual(
			gridRefToEastingNorthing('TG5140013177')
		);
	});

	it('returns null rather than guessing at malformed input', () => {
		for (const bad of ['', '   ', 'SP', '123456', 'SI1234', 'SP123', 'SP123456789012', null]) {
			expect(gridRefToEastingNorthing(bad)).toBeNull();
		}
	});
});

describe('eastingNorthingToWgs84', () => {
	// The OS worked example gives 52°39'27.2531"N 1°42'57.8663"E on OSGB36.
	// WGS84 sits a few tens of metres away, which is what the datum shift is
	// for, so this asserts the neighbourhood rather than the OSGB36 figure.
	it('converts the OS worked example to within 100m of its OSGB36 position', () => {
		const point = eastingNorthingToWgs84(651400, 313177);
		expect(haversineMetres(point, { lat: 52.65757, lon: 1.716074 })).toBeLessThan(100);
	});

	it('keeps the whole national grid inside a UK bounding box', () => {
		for (const [e, n] of [
			[90000, 10000],
			[400000, 400000],
			[651400, 313177],
			[300000, 800000],
			[450000, 1150000]
		]) {
			const { lat, lon } = eastingNorthingToWgs84(e, n);
			expect(lat).toBeGreaterThan(49);
			expect(lat).toBeLessThan(61.5);
			expect(lon).toBeGreaterThan(-9);
			expect(lon).toBeLessThan(3);
		}
	});

	it('moves north as northing rises and east as easting rises', () => {
		const base = eastingNorthingToWgs84(400000, 400000);
		expect(eastingNorthingToWgs84(400000, 500000).lat).toBeGreaterThan(base.lat);
		expect(eastingNorthingToWgs84(500000, 400000).lon).toBeGreaterThan(base.lon);
	});

	// 100km of northing should read as very close to 100km on the ground.
	it('preserves distance to within a fraction of a percent', () => {
		const a = eastingNorthingToWgs84(400000, 400000);
		const b = eastingNorthingToWgs84(400000, 500000);
		expect(haversineMetres(a, b)).toBeGreaterThan(99_000);
		expect(haversineMetres(a, b)).toBeLessThan(101_000);
	});
});

describe('gridRefToWgs84', () => {
	it('places a known coastal reference on the Norfolk coast', () => {
		const point = gridRefToWgs84('TG5140013177');
		expect(point.lat).toBeCloseTo(52.658, 2);
		expect(point.lon).toBeCloseTo(1.716, 2);
	});

	it('passes null through from a malformed reference', () => {
		expect(gridRefToWgs84('not a grid ref')).toBeNull();
	});
});

describe('haversineMetres', () => {
	it('is zero for the same point', () => {
		expect(haversineMetres({ lat: 51, lon: -1 }, { lat: 51, lon: -1 })).toBe(0);
	});

	it('measures a degree of latitude at about 111km', () => {
		const d = haversineMetres({ lat: 51, lon: -1 }, { lat: 52, lon: -1 });
		expect(d).toBeGreaterThan(111_000);
		expect(d).toBeLessThan(112_000);
	});
});
