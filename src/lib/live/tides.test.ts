import { describe, expect, it } from 'vitest';
import { findTideEvents, refineTurningPoint, roundToTenMinutes, summariseTide } from './tides';

/** One clean semidiurnal cycle, hourly, peaking near hour 3 and troughing near 9. */
function curve(startIso: string, hours: number): { times: string[]; heights: number[] } {
	const times: string[] = [];
	const heights: number[] = [];
	const start = Date.parse(startIso);
	for (let h = 0; h < hours; h += 1) {
		times.push(new Date(start + h * 36e5).toISOString());
		// Period 12.42h, amplitude 2m, shifted so high water lands off the hour.
		heights.push(2 * Math.sin(((h - 0.4) / 12.42) * 2 * Math.PI));
	}
	return { times, heights };
}

describe('refineTurningPoint', () => {
	it('puts the vertex mid-way when the neighbours are level', () => {
		expect(refineTurningPoint(1, 2, 1)).toEqual({ offsetHours: 0, height: 2 });
	});

	it('leans towards the higher neighbour', () => {
		const { offsetHours } = refineTurningPoint(1.9, 2, 1.0);
		expect(offsetHours).toBeLessThan(0);
	});

	it('recovers a peak higher than any sample', () => {
		// A true peak between two samples must read above both of them.
		const { height } = refineTurningPoint(1.9, 2, 1.8);
		expect(height).toBeGreaterThan(2);
	});

	it('falls back to the sampled point on a flat run rather than dividing by zero', () => {
		expect(refineTurningPoint(1, 1, 1)).toEqual({ offsetHours: 0, height: 1 });
	});
});

describe('findTideEvents', () => {
	it('finds alternating high and low water across a day', () => {
		const { times, heights } = curve('2026-09-04T00:00:00Z', 26);
		const events = findTideEvents(times, heights);
		expect(events.length).toBeGreaterThanOrEqual(2);
		for (let i = 1; i < events.length; i += 1) {
			expect(events[i].type).not.toBe(events[i - 1].type);
		}
	});

	it('interpolates rather than snapping the turn to the sampled hour', () => {
		// Asserted on the offset, not on the printed minutes: roundToTenMinutes
		// can legitimately land a refined turn back on the hour.
		const { offsetHours } = refineTurningPoint(1.2, 2.0, 1.9);
		expect(Math.abs(offsetHours)).toBeGreaterThan(0.05);
	});

	it('ignores gaps rather than reading a null as a turning point', () => {
		const events = findTideEvents(
			['2026-09-04T00:00:00Z', '2026-09-04T01:00:00Z', '2026-09-04T02:00:00Z'],
			[1, null, 1]
		);
		expect(events).toEqual([]);
	});

	it('reports nothing for a monotonic run', () => {
		const events = findTideEvents(
			['2026-09-04T00:00:00Z', '2026-09-04T01:00:00Z', '2026-09-04T02:00:00Z'],
			[1, 2, 3]
		);
		expect(events).toEqual([]);
	});
});

describe('summariseTide', () => {
	it('keeps only turning points still to come', () => {
		const { times, heights } = curve('2026-09-04T00:00:00Z', 48);
		const now = new Date('2026-09-04T12:00:00Z');
		const tide = summariseTide(times, heights, now);
		expect(tide).not.toBeNull();
		for (const event of tide?.events ?? []) {
			expect(Date.parse(event.at)).toBeGreaterThan(now.getTime());
		}
	});

	it('calls the tide rising when high water comes next', () => {
		const tide = summariseTide(
			['2026-09-04T10:00:00Z', '2026-09-04T11:00:00Z', '2026-09-04T12:00:00Z'],
			[1, 2, 1],
			new Date('2026-09-04T09:00:00Z')
		);
		expect(tide?.state).toBe('rising');
	});

	it('calls the tide falling when low water comes next', () => {
		const tide = summariseTide(
			['2026-09-04T10:00:00Z', '2026-09-04T11:00:00Z', '2026-09-04T12:00:00Z'],
			[2, 1, 2],
			new Date('2026-09-04T09:00:00Z')
		);
		expect(tide?.state).toBe('falling');
	});

	it('returns null for an inland point, whose series is all nulls', () => {
		const times = Array.from({ length: 24 }, (_, h) =>
			new Date(Date.parse('2026-09-04T00:00:00Z') + h * 36e5).toISOString()
		);
		expect(
			summariseTide(
				times,
				times.map(() => null),
				new Date('2026-09-04T00:00:00Z')
			)
		).toBeNull();
	});

	it('returns null once every turning point in the window has passed', () => {
		const tide = summariseTide(
			['2026-09-04T10:00:00Z', '2026-09-04T11:00:00Z', '2026-09-04T12:00:00Z'],
			[1, 2, 1],
			new Date('2026-09-05T00:00:00Z')
		);
		expect(tide).toBeNull();
	});
});

describe('roundToTenMinutes', () => {
	it('snaps to the nearest ten minutes', () => {
		expect(new Date(roundToTenMinutes(Date.parse('2026-09-04T17:34:00Z'))).toISOString()).toBe(
			'2026-09-04T17:30:00.000Z'
		);
		expect(new Date(roundToTenMinutes(Date.parse('2026-09-04T17:36:00Z'))).toISOString()).toBe(
			'2026-09-04T17:40:00.000Z'
		);
	});

	it('blunts the displayed precision of a turning point', () => {
		// The model runs tens of minutes out against real gauges, so a time to
		// the minute would claim an accuracy the data does not have.
		const events = findTideEvents(
			['2026-09-04T10:00:00Z', '2026-09-04T11:00:00Z', '2026-09-04T12:00:00Z'],
			[1.0, 2.0, 1.4]
		);
		expect(new Date(events[0].at).getUTCMinutes() % 10).toBe(0);
	});
});
