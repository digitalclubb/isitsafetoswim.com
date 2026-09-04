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
		// Naive UK local, so BST in May: 06:00 local is 05:00Z.
		expect(r?.startedAt).toBe('2026-05-31T05:00:00.000Z');
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
		expect(r?.endedAt).toBe('2026-05-30T03:00:00.000Z');
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

describe('Thames timestamps are UK local', () => {
	it('reads a summer timestamp as BST rather than UTC', () => {
		// Thames publishes naive local times. Parsed as UTC they land an hour in
		// the future all summer, which is the same defect fixed for Welsh Water.
		const r = parseThamesRecord({
			locationName: 'Summer CSO',
			x: 523040,
			y: 178150,
			alertStatus: 'Discharging',
			mostRecentDischargeAlertStart: '2026-07-01T12:00:00'
		});
		expect(r?.startedAt).toBe('2026-07-01T11:00:00.000Z');
	});

	it('reads a winter timestamp as GMT', () => {
		const r = parseThamesRecord({
			locationName: 'Winter CSO',
			x: 523040,
			y: 178150,
			alertStatus: 'Discharging',
			mostRecentDischargeAlertStart: '2026-01-15T12:00:00'
		});
		expect(r?.startedAt).toBe('2026-01-15T12:00:00.000Z');
	});

	it('leaves a timestamp that already carries an offset alone', () => {
		const r = parseThamesRecord({
			locationName: 'Zoned CSO',
			x: 523040,
			y: 178150,
			alertStatus: 'Discharging',
			mostRecentDischargeAlertStart: '2026-07-01T12:00:00Z'
		});
		expect(r?.startedAt).toBe('2026-07-01T12:00:00.000Z');
	});
});
