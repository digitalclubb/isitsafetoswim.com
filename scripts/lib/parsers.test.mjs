import { describe, expect, it } from 'vitest';
import {
	classifyValue,
	dedupeSlugs,
	extractLabel,
	lastNonEmptyPathSegment,
	readEaBoolean,
	readSamplingPoint,
	slugify,
	waterTypeFromEaType,
	yearFromComplianceUri
} from './parsers.mjs';

describe('waterTypeFromEaType', () => {
	const uri = (leaf) => `http://environment.data.gov.uk/def/bathing-water/${leaf}`;

	it('classes rivers and lakes as inland', () => {
		expect(waterTypeFromEaType([uri('BathingWater'), uri('RiverBathingWater')])).toBe('inland');
		expect(waterTypeFromEaType([uri('LakeBathingWater')])).toBe('inland');
	});

	it('classes coastal and transitional (estuarine) as coastal', () => {
		expect(waterTypeFromEaType([uri('CoastalBathingWater')])).toBe('coastal');
		expect(waterTypeFromEaType([uri('TransitionalBathingWater')])).toBe('coastal');
	});

	it('defaults unknown or missing type to coastal', () => {
		expect(waterTypeFromEaType(undefined)).toBe('coastal');
		expect(waterTypeFromEaType([])).toBe('coastal');
	});
});

describe('readEaBoolean', () => {
	it('reads a bare boolean', () => {
		expect(readEaBoolean(false)).toBe(false);
		expect(readEaBoolean(true)).toBe(true);
	});

	it('reads a wrapped value and a string', () => {
		expect(readEaBoolean({ _value: true })).toBe(true);
		expect(readEaBoolean('true')).toBe(true);
		expect(readEaBoolean('false')).toBe(false);
	});

	it('returns undefined when absent', () => {
		expect(readEaBoolean(undefined)).toBeUndefined();
		expect(readEaBoolean(null)).toBeUndefined();
	});
});

describe('slugify', () => {
	it('lowercases and dashes ordinary names', () => {
		expect(slugify('Bournemouth Pier')).toBe('bournemouth-pier');
	});

	it('strips combining marks', () => {
		expect(slugify('Aberystwyth')).toBe('aberystwyth');
		expect(slugify('Café del Mar')).toBe('cafe-del-mar');
	});

	it('expands ampersands', () => {
		expect(slugify('Ards & North Down')).toBe('ards-and-north-down');
	});

	it('handles null and undefined safely', () => {
		expect(slugify(undefined)).toBe('');
		expect(slugify(null)).toBe('');
	});

	it('trims leading and trailing dashes', () => {
		expect(slugify('  Llanishen Reservoir  ')).toBe('llanishen-reservoir');
	});
});

describe('classifyValue', () => {
	it('maps standard EA labels', () => {
		expect(classifyValue('Excellent')).toBe('Excellent');
		expect(classifyValue('Good')).toBe('Good');
		expect(classifyValue('Sufficient')).toBe('Sufficient');
		expect(classifyValue('Poor')).toBe('Poor');
	});

	it('only matches the exact word for new', () => {
		expect(classifyValue('New')).toBe('New');
		expect(classifyValue('Renewed assessment')).toBe('Unknown');
	});

	it('treats sufficient before good', () => {
		expect(classifyValue('Sufficient (good in places)')).toBe('Sufficient');
	});

	it('handles closed and decommissioned', () => {
		expect(classifyValue('Closed')).toBe('Closed');
		expect(classifyValue('Decommissioned site')).toBe('Closed');
	});

	it('defaults to Unknown', () => {
		expect(classifyValue(null)).toBe('Unknown');
		expect(classifyValue(undefined)).toBe('Unknown');
		expect(classifyValue('totally unexpected value')).toBe('Unknown');
	});
});

describe('extractLabel', () => {
	it('reads langString shape', () => {
		expect(extractLabel({ _value: 'Spittal', _lang: 'en' })).toBe('Spittal');
	});

	it('skips raw URIs in arrays alongside labelled objects', () => {
		const district = [
			{ name: { _value: 'Northumberland', _lang: 'en' } },
			'http://statistics.data.gov.uk/id/statistical-geography/E06000057'
		];
		expect(extractLabel(district)).toBe('Northumberland');
	});

	it('recurses through nested name objects', () => {
		const node = { name: { _value: 'Llanishen Reservoir' } };
		expect(extractLabel(node)).toBe('Llanishen Reservoir');
	});

	// A unitary authority is listed as both the district and the county, which
	// produced regions named "South Hams, South Hams" and split an area hub.
	it('collapses a label the EA repeats for a unitary authority', () => {
		const district = [
			{ name: { _value: 'South Hams', _lang: 'en' } },
			{ name: { _value: 'South Hams', _lang: 'en' } }
		];
		expect(extractLabel(district)).toBe('South Hams');
	});

	it('still joins genuinely different labels', () => {
		const district = [
			{ name: { _value: 'Bournemouth', _lang: 'en' } },
			{ name: { _value: 'Christchurch', _lang: 'en' } }
		];
		expect(extractLabel(district)).toBe('Bournemouth, Christchurch');
	});

	it('returns plain strings unchanged', () => {
		expect(extractLabel('Plain string')).toBe('Plain string');
	});

	it('returns undefined for empty arrays and unknown shapes', () => {
		expect(extractLabel([])).toBeUndefined();
		expect(extractLabel({ foo: 'bar' })).toBeUndefined();
		expect(extractLabel(undefined)).toBeUndefined();
	});

	it('survives nested object inside _value without throwing', () => {
		const odd = { _value: { _value: 'Deep' } };
		expect(extractLabel(odd)).toBe('Deep');
	});
});

describe('readSamplingPoint', () => {
	it('reads EA lat/long shape', () => {
		expect(readSamplingPoint({ lat: 55.75, long: -1.98 })).toEqual({ lat: 55.75, lon: -1.98 });
	});

	it('accepts longitude alias', () => {
		expect(readSamplingPoint({ latitude: 1, longitude: 2 })).toEqual({ lat: 1, lon: 2 });
	});

	it('rejects non-numeric or missing values', () => {
		expect(readSamplingPoint({ lat: 'x', long: 1 })).toBeNull();
		expect(readSamplingPoint(null)).toBeNull();
	});
});

describe('lastNonEmptyPathSegment', () => {
	it('returns the final segment', () => {
		expect(lastNonEmptyPathSegment('http://example.com/id/bathing-water/ukk3101-26520')).toBe(
			'ukk3101-26520'
		);
	});

	it('ignores trailing slashes', () => {
		expect(lastNonEmptyPathSegment('http://example.com/bathing-water/ukx-1/')).toBe('ukx-1');
	});

	it('returns undefined for empty or non-strings', () => {
		expect(lastNonEmptyPathSegment('')).toBeUndefined();
		expect(lastNonEmptyPathSegment(undefined)).toBeUndefined();
	});
});

describe('dedupeSlugs', () => {
	it('leaves unique slugs untouched', () => {
		const locs = [
			{ slug: 'spittal', country: 'England', name: 'Spittal' },
			{ slug: 'gullane', country: 'Scotland', name: 'Gullane' }
		];
		dedupeSlugs(locs);
		expect(locs.map((l) => l.slug)).toEqual(['spittal', 'gullane']);
	});

	it('suffixes the country when colliding cross-border', () => {
		const locs = [
			{ slug: 'newport', country: 'England', name: 'Newport' },
			{ slug: 'newport', country: 'Wales', name: 'Newport' }
		];
		dedupeSlugs(locs);
		expect(locs[0].slug).toBe('newport');
		expect(locs[1].slug).toBe('newport-wales');
	});

	it('numbers subsequent collisions within the same country', () => {
		const locs = [
			{ slug: 'sandy-bay', country: 'England', name: 'Sandy Bay' },
			{ slug: 'sandy-bay', country: 'England', name: 'Sandy Bay' },
			{ slug: 'sandy-bay', country: 'England', name: 'Sandy Bay' }
		];
		dedupeSlugs(locs);
		expect(locs.map((l) => l.slug)).toEqual(['sandy-bay', 'sandy-bay-2', 'sandy-bay-3']);
	});

	it('fills in a slug when missing', () => {
		const locs = [{ slug: '', country: 'England', name: 'Anonymous Bay' }];
		dedupeSlugs(locs);
		expect(locs[0].slug).toBe('anonymous-bay');
	});
});

describe('yearFromComplianceUri', () => {
	it('reads the year out of an EA compliance URI', () => {
		expect(
			yearFromComplianceUri(
				'http://environment.data.gov.uk/data/bathing-water-quality/compliance-rBWD/point/14900/year/2025'
			)
		).toBe(2025);
	});

	it('reads the year out of an NRW compliance URI', () => {
		expect(
			yearFromComplianceUri(
				'http://environment.data.gov.uk/wales/bathing-waters/data/bathing-water-quality/compliance-rBWD/point/36040/year/2024'
			)
		).toBe(2024);
	});

	it('returns undefined for a URI with no year segment', () => {
		expect(
			yearFromComplianceUri('http://environment.data.gov.uk/id/bathing-water/ukj2100-14900')
		).toBeUndefined();
	});

	it('rejects an implausible year rather than putting it on a page', () => {
		expect(yearFromComplianceUri('http://example.org/year/9999')).toBeUndefined();
	});

	it('ignores non-string input', () => {
		expect(yearFromComplianceUri(undefined)).toBeUndefined();
		expect(yearFromComplianceUri(2025)).toBeUndefined();
	});
});
