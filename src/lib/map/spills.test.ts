import { describe, expect, it } from 'vitest';
import type { DischargeEvent } from '$lib/data/types';
import { aggregateSpills, type SpillSource } from './spills';

function source(over: Partial<SpillSource> & { discharges: DischargeEvent[] }): SpillSource {
	return {
		slug: 'beach',
		name: 'Beach',
		country: 'England',
		lat: 50,
		lon: -1,
		company: 'Acme Water',
		...over
	};
}

function discharge(over: Partial<DischargeEvent>): DischargeEvent {
	return {
		outfallName: 'Outfall 1',
		distanceMetres: 1000,
		startedAt: '2026-06-17T10:00:00Z',
		ongoing: true,
		...over
	};
}

describe('aggregateSpills', () => {
	it('dedupes an outfall near two beaches to the nearest one', () => {
		const spills = aggregateSpills([
			source({ slug: 'far', name: 'Far', discharges: [discharge({ distanceMetres: 4000 })] }),
			source({ slug: 'near', name: 'Near', discharges: [discharge({ distanceMetres: 800 })] })
		]);
		expect(spills).toHaveLength(1);
		expect(spills[0].beachSlug).toBe('near');
		expect(spills[0].distanceMetres).toBe(800);
	});

	it('keeps different outfalls and different companies separate', () => {
		const spills = aggregateSpills([
			source({ discharges: [discharge({ outfallName: 'A' }), discharge({ outfallName: 'B' })] }),
			source({ company: 'Other Water', discharges: [discharge({ outfallName: 'A' })] })
		]);
		expect(spills).toHaveLength(3);
	});

	it('orders ongoing first, then most recently started', () => {
		const spills = aggregateSpills([
			source({
				discharges: [
					discharge({
						outfallName: 'old-finished',
						ongoing: false,
						startedAt: '2026-06-17T01:00:00Z',
						endedAt: '2026-06-17T02:00:00Z'
					}),
					discharge({ outfallName: 'new-ongoing', ongoing: true, startedAt: '2026-06-17T09:00:00Z' }),
					discharge({ outfallName: 'old-ongoing', ongoing: true, startedAt: '2026-06-17T03:00:00Z' })
				]
			})
		]);
		expect(spills.map((s) => s.outfallName)).toEqual(['new-ongoing', 'old-ongoing', 'old-finished']);
	});

	it('keeps unnamed outfalls at different locations separate by coordinates', () => {
		const spills = aggregateSpills([
			source({
				discharges: [
					discharge({ outfallName: 'Outfall', lat: 50.1, lon: -1.1 }),
					discharge({ outfallName: 'Outfall', lat: 50.2, lon: -1.2 })
				]
			})
		]);
		expect(spills).toHaveLength(2);
	});

	it('dedupes the same outfall (same coordinates) seen from two beaches', () => {
		const spills = aggregateSpills([
			source({
				slug: 'far',
				discharges: [discharge({ outfallName: 'Outfall', lat: 50.1, lon: -1.1, distanceMetres: 4000 })]
			}),
			source({
				slug: 'near',
				discharges: [discharge({ outfallName: 'Outfall', lat: 50.1, lon: -1.1, distanceMetres: 800 })]
			})
		]);
		expect(spills).toHaveLength(1);
		expect(spills[0].beachSlug).toBe('near');
	});

	it('returns an empty list when there are no discharges', () => {
		expect(aggregateSpills([source({ discharges: [] })])).toEqual([]);
	});
});
