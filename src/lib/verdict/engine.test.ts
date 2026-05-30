import { describe, expect, it } from 'vitest';
import type { DischargeEvent } from '$lib/data/types';
import { bathingSeasonActive, decideAt, evaluateVerdict } from './engine';

const summerNow = new Date('2026-07-15T10:00:00Z');
const winterNow = new Date('2026-01-15T10:00:00Z');

function discharge(partial: Partial<DischargeEvent>): DischargeEvent {
	return {
		outfallName: 'Outfall A',
		distanceMetres: 1500,
		startedAt: '2026-07-15T08:00:00Z',
		ongoing: false,
		...partial
	};
}

describe('bathingSeasonActive', () => {
	it('is active mid-July', () => {
		expect(bathingSeasonActive(summerNow)).toBe(true);
	});

	it('is inactive in January', () => {
		expect(bathingSeasonActive(winterNow)).toBe(false);
	});

	it('opens on 15 May', () => {
		expect(bathingSeasonActive(new Date('2026-05-14T23:00:00Z'))).toBe(false);
		expect(bathingSeasonActive(new Date('2026-05-15T00:00:00Z'))).toBe(true);
	});

	it('closes on 30 September', () => {
		expect(bathingSeasonActive(new Date('2026-09-30T23:00:00Z'))).toBe(true);
		expect(bathingSeasonActive(new Date('2026-10-01T00:00:00Z'))).toBe(false);
	});
});

describe('evaluateVerdict — hard No', () => {
	it('returns No when sewage is being discharged within 5km', () => {
		const result = evaluateVerdict({
			classification: 'Excellent',
			latestSample: null,
			riskForecast: { riskLevel: 'normal' },
			recentDischarges: [discharge({ ongoing: true, distanceMetres: 1200 })],
			rainfall24hMm: 0,
			now: summerNow
		});
		expect(result.verdict).toBe('no');
		expect(result.headline).toBe('No.');
		expect(result.reason).toMatch(/sewage being discharged/i);
	});

	it('returns No when sewage finished within 12h and was within 5km', () => {
		const result = evaluateVerdict({
			classification: 'Good',
			latestSample: null,
			riskForecast: { riskLevel: 'normal' },
			recentDischarges: [
				discharge({
					distanceMetres: 2000,
					startedAt: '2026-07-15T02:00:00Z',
					endedAt: '2026-07-15T05:00:00Z',
					ongoing: false
				})
			],
			rainfall24hMm: 0,
			now: summerNow
		});
		expect(result.verdict).toBe('no');
		expect(result.reason).toMatch(/sewage discharged/i);
	});

	it('returns No for Poor classification in season', () => {
		const result = evaluateVerdict({
			classification: 'Poor',
			latestSample: null,
			riskForecast: null,
			recentDischarges: [],
			rainfall24hMm: 0,
			now: summerNow
		});
		expect(result.verdict).toBe('no');
		expect(result.reason).toMatch(/Poor/);
	});

	it('returns No when classification is Closed', () => {
		const result = evaluateVerdict({
			classification: 'Closed',
			latestSample: null,
			riskForecast: null,
			recentDischarges: [],
			rainfall24hMm: 0,
			now: summerNow
		});
		expect(result.verdict).toBe('no');
		expect(result.reason).toMatch(/closed/i);
	});

	it('returns No when E. coli is at or above the danger threshold', () => {
		const result = evaluateVerdict({
			classification: 'Good',
			latestSample: { sampledAt: '2026-07-10', eColi: 1500 },
			riskForecast: null,
			recentDischarges: [],
			rainfall24hMm: 0,
			now: summerNow
		});
		expect(result.verdict).toBe('no');
		expect(result.reason).toMatch(/1500/);
	});
});

describe('evaluateVerdict — caution', () => {
	it('returns Caution for a discharge within 10km in the last 48h', () => {
		const result = evaluateVerdict({
			classification: 'Excellent',
			latestSample: null,
			riskForecast: { riskLevel: 'normal' },
			recentDischarges: [
				discharge({
					distanceMetres: 7500,
					startedAt: '2026-07-14T08:00:00Z',
					endedAt: '2026-07-14T10:00:00Z'
				})
			],
			rainfall24hMm: 0,
			now: summerNow
		});
		expect(result.verdict).toBe('caution');
	});

	it('returns Caution when daily risk forecast is increased', () => {
		const result = evaluateVerdict({
			classification: 'Excellent',
			latestSample: null,
			riskForecast: { riskLevel: 'increased' },
			recentDischarges: [],
			rainfall24hMm: 0,
			now: summerNow
		});
		expect(result.verdict).toBe('caution');
		expect(result.reason).toMatch(/risk/i);
	});

	it('returns Caution after heavy rain', () => {
		const result = evaluateVerdict({
			classification: 'Excellent',
			latestSample: null,
			riskForecast: { riskLevel: 'normal' },
			recentDischarges: [],
			rainfall24hMm: 20,
			now: summerNow
		});
		expect(result.verdict).toBe('caution');
		expect(result.reason).toMatch(/rain/);
	});

	it('returns Caution for Sufficient classification', () => {
		const result = evaluateVerdict({
			classification: 'Sufficient',
			latestSample: null,
			riskForecast: { riskLevel: 'normal' },
			recentDischarges: [],
			rainfall24hMm: 0,
			now: summerNow
		});
		expect(result.verdict).toBe('caution');
	});

	it('returns Caution for new and unknown classifications', () => {
		for (const c of ['New', 'Unknown'] as const) {
			const result = evaluateVerdict({
				classification: c,
				latestSample: null,
				riskForecast: null,
				recentDischarges: [],
				rainfall24hMm: 0,
				now: summerNow
			});
			expect(result.verdict).toBe('caution');
		}
	});

	it('returns Caution when out of season', () => {
		const result = evaluateVerdict({
			classification: 'Excellent',
			latestSample: null,
			riskForecast: null,
			recentDischarges: [],
			rainfall24hMm: 0,
			now: winterNow
		});
		expect(result.verdict).toBe('caution');
		expect(result.reason).toMatch(/bathing season/i);
	});

	it('returns Caution for elevated but sub-danger E. coli', () => {
		const result = evaluateVerdict({
			classification: 'Good',
			latestSample: { sampledAt: '2026-07-10', eColi: 700 },
			riskForecast: null,
			recentDischarges: [],
			rainfall24hMm: 0,
			now: summerNow
		});
		expect(result.verdict).toBe('caution');
	});
});

describe('evaluateVerdict — Yes', () => {
	it('returns Yes when classification is Excellent and everything is clean', () => {
		const result = evaluateVerdict({
			classification: 'Excellent',
			latestSample: { sampledAt: '2026-07-10', eColi: 5 },
			riskForecast: { riskLevel: 'normal' },
			recentDischarges: [],
			rainfall24hMm: 1,
			now: summerNow
		});
		expect(result.verdict).toBe('yes');
		expect(result.headline).toBe('Yes.');
		expect(result.reason).toMatch(/Excellent/);
	});

	it('returns Yes for Good classification with no other warnings', () => {
		const result = evaluateVerdict({
			classification: 'Good',
			latestSample: { sampledAt: '2026-07-10', eColi: 80 },
			riskForecast: { riskLevel: 'normal' },
			recentDischarges: [],
			rainfall24hMm: null,
			now: summerNow
		});
		expect(result.verdict).toBe('yes');
		expect(result.reason).toMatch(/Good/);
	});

	it('always includes the annual classification as a factor', () => {
		const result = evaluateVerdict({
			classification: 'Excellent',
			latestSample: null,
			riskForecast: null,
			recentDischarges: [],
			rainfall24hMm: null,
			now: summerNow
		});
		expect(result.factors.find((f) => f.label === 'Annual classification')?.value).toBe(
			'Excellent'
		);
	});
});

describe('decideAt wrapper', () => {
	it('attaches fetchedAt and dataAge', () => {
		const result = decideAt(
			{
				classification: 'Good',
				latestSample: null,
				riskForecast: null,
				recentDischarges: [],
				rainfall24hMm: null,
				now: summerNow
			},
			'cached'
		);
		expect(result.fetchedAt).toBe(summerNow.toISOString());
		expect(result.dataAge).toBe('cached');
	});
});
