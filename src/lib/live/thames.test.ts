import { describe, expect, it } from 'vitest';
import { parseThamesRecord } from './thames';

describe('parseThamesRecord', () => {
	it('parses an ongoing discharge and reprojects its OSGB36 coordinates', () => {
		const r = parseThamesRecord({
			locationName: '(Northern) Low Level No1 Brook Green CSO',
			receivingWaterCourse: 'River Thames',
			x: 523040,
			y: 178150,
			alertStatus: 'Discharging',
			mostRecentDischargeAlertStart: '2026-05-31T06:00:00'
		});
		expect(r).not.toBeNull();
		expect(r?.ongoing).toBe(true);
		expect(r?.endedAt).toBeUndefined();
		expect(r?.receivingWater).toBe('River Thames');
		expect(r?.startedAt).toBe('2026-05-31T06:00:00.000Z');
		// West London ballpark after reprojection.
		expect(r?.lat).toBeGreaterThan(51.4);
		expect(r?.lat).toBeLessThan(51.6);
		expect(r?.lon).toBeGreaterThan(-0.3);
		expect(r?.lon).toBeLessThan(0.05);
	});

	it('parses a finished discharge with an end time', () => {
		const r = parseThamesRecord({
			locationName: 'Mogden STW',
			x: 516400,
			y: 175300,
			alertStatus: 'Not discharging',
			mostRecentDischargeAlertStart: '2026-05-30T01:00:00',
			mostRecentDischargeAlertStop: '2026-05-30T04:00:00'
		});
		expect(r?.ongoing).toBe(false);
		expect(r?.endedAt).toBe('2026-05-30T04:00:00.000Z');
	});

	it('tolerates the legacy PascalCase field names', () => {
		const r = parseThamesRecord({
			LocationName: 'Legacy CSO',
			X: 523040,
			Y: 178150,
			AlertStatus: 'Discharging',
			MostRecentDischargeAlertStart: '2026-05-31T06:00:00'
		});
		expect(r?.ongoing).toBe(true);
		expect(r?.outfallName).toBe('Legacy CSO');
	});

	it('returns null without coordinates', () => {
		expect(
			parseThamesRecord({
				alertStatus: 'Discharging',
				mostRecentDischargeAlertStart: '2026-05-31T06:00:00'
			})
		).toBeNull();
	});

	it('returns null for an offline monitor with no discharge timing', () => {
		expect(parseThamesRecord({ x: 520000, y: 180000, alertStatus: 'Offline' })).toBeNull();
	});
});
