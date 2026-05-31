import { describe, expect, it } from 'vitest';
import { parseThamesRecord } from './thames';

describe('parseThamesRecord', () => {
	it('parses an ongoing discharge and reprojects its coordinates', () => {
		const r = parseThamesRecord({
			LocationName: 'Mogden STW',
			ReceivingWaterCourse: 'River Thames',
			X: 516400,
			Y: 175300,
			AlertStatus: 'Discharging',
			MostRecentDischargeAlertStart: '2026-05-31T06:00:00'
		});
		expect(r).not.toBeNull();
		expect(r?.ongoing).toBe(true);
		expect(r?.endedAt).toBeUndefined();
		expect(r?.receivingWater).toBe('River Thames');
		// South-west London ballpark after reprojection.
		expect(r?.lat).toBeGreaterThan(51.3);
		expect(r?.lat).toBeLessThan(51.6);
		expect(r?.lon).toBeGreaterThan(-0.5);
		expect(r?.lon).toBeLessThan(0.1);
	});

	it('parses a finished discharge with an end time', () => {
		const r = parseThamesRecord({
			LocationName: 'Acton STW',
			X: 520000,
			Y: 180000,
			AlertStatus: 'Not discharging',
			MostRecentDischargeAlertStart: '2026-05-30T01:00:00',
			MostRecentDischargeAlertStop: '2026-05-30T04:00:00'
		});
		expect(r?.ongoing).toBe(false);
		expect(r?.endedAt).toBe(new Date('2026-05-30T04:00:00').toISOString());
	});

	it('returns null without coordinates', () => {
		expect(
			parseThamesRecord({
				AlertStatus: 'Discharging',
				MostRecentDischargeAlertStart: '2026-05-31T06:00:00'
			})
		).toBeNull();
	});

	it('returns null for an offline monitor with no discharge timing', () => {
		expect(parseThamesRecord({ X: 520000, Y: 180000, AlertStatus: 'Offline' })).toBeNull();
	});
});
