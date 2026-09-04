import { describe, expect, it } from 'vitest';
import type { Country, LiveLocationData, RiskForecast } from '$lib/data/types';
import { coverageNotice, hasLiveSignals } from './coverage';

function live(country: Country, partial: Partial<LiveLocationData> = {}): LiveLocationData {
	return {
		location: {
			id: 'x-1',
			slug: 'somewhere',
			name: 'Somewhere',
			country,
			lat: 55,
			lon: -3,
			classification: 'Sufficient',
			source: { api: country === 'Scotland' ? 'sepa' : 'ea', sourceId: '1' }
		},
		classification: 'Sufficient',
		latestSample: null,
		riskForecast: null,
		recentDischarges: [],
		hasDischargeFeed: false,
		rainfall24hMm: null,
		sampleHistory: [],
		seaTemperatureC: null,
		tide: null,
		verdict: {
			verdict: 'caution',
			headline: 'Caution.',
			reason: 'Annual classification is only Sufficient.',
			factors: [],
			fetchedAt: '2026-09-04T10:00:00Z',
			dataAge: 'fresh'
		},
		attribution: [],
		...partial
	};
}

const forecast: RiskForecast = { riskLevel: 'increased' };

describe('coverageNotice', () => {
	it('says a Scottish site has no prediction when none is showing', () => {
		expect(coverageNotice(live('Scotland'))).toBe('sepa-none');
	});

	it('stops denying the SEPA prediction the moment one arrives', () => {
		// This is the contradiction the single-value notice exists to prevent: a
		// Scottish page can carry an increased forecast as the factor driving its
		// verdict while a paragraph beneath it says no forecast is showing.
		expect(coverageNotice(live('Scotland', { riskForecast: forecast }))).toBe('sepa-forecast');
	});

	it('never returns a SEPA notice for Northern Ireland', () => {
		expect(coverageNotice(live('Northern Ireland'))).toBe('daera-reading');
		expect(coverageNotice(live('Northern Ireland', { riskForecast: forecast }))).toBe(
			'daera-forecast'
		);
	});

	it('reports the DAERA prediction for the six sites that have one', () => {
		expect(coverageNotice(live('Northern Ireland', { riskForecast: forecast }))).toBe(
			'daera-forecast'
		);
	});

	it('falls back to the weekly reading where DAERA runs no prediction', () => {
		expect(coverageNotice(live('Northern Ireland'))).toBe('daera-reading');
	});

	it('calls England quiet when its feeds were checked and found nothing', () => {
		expect(coverageNotice(live('England'))).toBe('quiet');
		expect(coverageNotice(live('Wales'))).toBe('quiet');
	});

	it('calls England full once there is something to report', () => {
		expect(
			coverageNotice(
				live('England', { latestSample: { sampledAt: '2026-09-01T10:00:00Z', eColi: 10 } })
			)
		).toBe('full');
		expect(
			coverageNotice(
				live('England', {
					recentDischarges: [
						{
							outfallName: 'Outfall',
							distanceMetres: 900,
							startedAt: '2026-09-04T08:00:00Z',
							endedAt: '2026-09-04T09:00:00Z',
							ongoing: false
						}
					]
				})
			)
		).toBe('full');
	});

	it('never claims live coverage for a country that has none', () => {
		// "quiet" and "full" both imply feeds were checked. Only England and Wales
		// may reach them, or an empty list would read as an all-clear on sewage.
		for (const country of ['Scotland', 'Northern Ireland'] as const) {
			const notice = coverageNotice(live(country));
			expect(notice).not.toBe('quiet');
			expect(notice).not.toBe('full');
		}
	});
});

describe('hasLiveSignals', () => {
	it('is true only where live forecast and sample feeds exist', () => {
		expect(hasLiveSignals('England')).toBe(true);
		expect(hasLiveSignals('Wales')).toBe(true);
		expect(hasLiveSignals('Scotland')).toBe(false);
		expect(hasLiveSignals('Northern Ireland')).toBe(false);
	});
});
