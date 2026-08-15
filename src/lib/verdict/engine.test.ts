import { describe, expect, it } from 'vitest';
import type { DischargeEvent } from '$lib/data/types';
import { _internals, bathingSeasonActive, decideAt, evaluateVerdict } from './engine';

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

	it('does not caution a clean site merely for being out of season', () => {
		const result = evaluateVerdict({
			classification: 'Excellent',
			latestSample: null,
			riskForecast: null,
			recentDischarges: [],
			rainfall24hMm: 0,
			now: winterNow
		});
		expect(result.verdict).toBe('yes');
		expect(result.reason).toMatch(/rated Excellent/i);
		expect(result.reason).not.toMatch(/bathing season/i);
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
		expect(result.factors.find((f) => f.label === 'Annual classification')?.value).toBe('Excellent');
	});
});

describe('evaluateVerdict — sample parameters and water type', () => {
	it('returns No when intestinal enterococci is high at the coast', () => {
		const result = evaluateVerdict({
			classification: 'Good',
			latestSample: { sampledAt: '2026-07-10', eColi: 50, intestinalEnterococci: 500 },
			riskForecast: null,
			recentDischarges: [],
			rainfall24hMm: 0,
			waterType: 'coastal',
			now: summerNow
		});
		expect(result.verdict).toBe('no');
		expect(result.reason).toMatch(/intestinal enterococci/);
		expect(result.reason).toMatch(/500/);
	});

	it('returns Caution for elevated intestinal enterococci even when E. coli is clean', () => {
		const result = evaluateVerdict({
			classification: 'Good',
			latestSample: { sampledAt: '2026-07-10', eColi: 20, intestinalEnterococci: 250 },
			riskForecast: null,
			recentDischarges: [],
			rainfall24hMm: 0,
			waterType: 'coastal',
			now: summerNow
		});
		expect(result.verdict).toBe('caution');
		expect(result.reason).toMatch(/enterococci/);
	});

	it('applies the more lenient inland thresholds for river and lake waters', () => {
		// E. coli 700 cautions at the coast but sits within the inland Good boundary.
		const coastal = evaluateVerdict({
			classification: 'Good',
			latestSample: { sampledAt: '2026-07-10', eColi: 700 },
			riskForecast: { riskLevel: 'normal' },
			recentDischarges: [],
			rainfall24hMm: 0,
			waterType: 'coastal',
			now: summerNow
		});
		const inland = evaluateVerdict({
			classification: 'Good',
			latestSample: { sampledAt: '2026-07-10', eColi: 700 },
			riskForecast: { riskLevel: 'normal' },
			recentDischarges: [],
			rainfall24hMm: 0,
			waterType: 'inland',
			now: summerNow
		});
		expect(coastal.verdict).toBe('caution');
		expect(inland.verdict).toBe('yes');
	});

	it('treats E. coli 1500 as No at the coast but only Caution inland', () => {
		const coastal = evaluateVerdict({
			classification: 'Good',
			latestSample: { sampledAt: '2026-07-10', eColi: 1500 },
			riskForecast: { riskLevel: 'normal' },
			recentDischarges: [],
			rainfall24hMm: 0,
			waterType: 'coastal',
			now: summerNow
		});
		const inland = evaluateVerdict({
			classification: 'Good',
			latestSample: { sampledAt: '2026-07-10', eColi: 1500 },
			riskForecast: { riskLevel: 'normal' },
			recentDischarges: [],
			rainfall24hMm: 0,
			waterType: 'inland',
			now: summerNow
		});
		expect(coastal.verdict).toBe('no');
		expect(inland.verdict).toBe('caution');
	});

	it('defaults to coastal thresholds when water type is unknown', () => {
		const result = evaluateVerdict({
			classification: 'Good',
			latestSample: { sampledAt: '2026-07-10', eColi: 700 },
			riskForecast: { riskLevel: 'normal' },
			recentDischarges: [],
			rainfall24hMm: 0,
			now: summerNow
		});
		expect(result.verdict).toBe('caution');
	});

	it('reports both E. coli and intestinal enterococci as factors', () => {
		const result = evaluateVerdict({
			classification: 'Excellent',
			latestSample: { sampledAt: '2026-07-10', eColi: 10, intestinalEnterococci: 15 },
			riskForecast: { riskLevel: 'normal' },
			recentDischarges: [],
			rainfall24hMm: 0,
			waterType: 'coastal',
			now: summerNow
		});
		expect(result.factors.find((f) => f.label === 'Latest E. coli')).toBeTruthy();
		expect(result.factors.find((f) => f.label === 'Latest intestinal enterococci')).toBeTruthy();
	});
});

describe('evaluateVerdict — rain susceptibility', () => {
	it('does not raise a caution from rainfall when the site is not rain-impacted', () => {
		const result = evaluateVerdict({
			classification: 'Excellent',
			latestSample: null,
			riskForecast: { riskLevel: 'normal' },
			recentDischarges: [],
			rainfall24hMm: 20,
			waterType: 'coastal',
			rainImpacted: false,
			now: summerNow
		});
		expect(result.verdict).toBe('yes');
	});

	it('still raises a caution from heavy rain when the rain-impact flag is unknown', () => {
		const result = evaluateVerdict({
			classification: 'Excellent',
			latestSample: null,
			riskForecast: { riskLevel: 'normal' },
			recentDischarges: [],
			rainfall24hMm: 20,
			waterType: 'coastal',
			now: summerNow
		});
		expect(result.verdict).toBe('caution');
		expect(result.reason).toMatch(/rain/);
	});

	it('still raises a caution from heavy rain when the site is rain-impacted', () => {
		const result = evaluateVerdict({
			classification: 'Excellent',
			latestSample: null,
			riskForecast: { riskLevel: 'normal' },
			recentDischarges: [],
			rainfall24hMm: 20,
			rainImpacted: true,
			now: summerNow
		});
		expect(result.verdict).toBe('caution');
		expect(result.reason).toMatch(/rain/);
	});
});

describe('evaluateVerdict — no storm-overflow feed', () => {
	// An empty discharge list means "not checked" for the 237 sites outside
	// England, so the reason must not claim an all-clear on sewage.
	it('does not claim no sewage when there was no feed to check', () => {
		for (const now of [summerNow, winterNow]) {
			const result = evaluateVerdict({
				classification: 'Good',
				latestSample: null,
				riskForecast: null,
				recentDischarges: [],
				rainfall24hMm: 0,
				hasDischargeFeed: false,
				now
			});
			expect(result.verdict).toBe('yes');
			expect(result.reason).toBe('Rated Good in the latest annual classification.');
			expect(result.reason).not.toMatch(/sewage/i);
		}
	});

	it('still claims the all-clear when a feed was available', () => {
		const result = evaluateVerdict({
			classification: 'Good',
			latestSample: null,
			riskForecast: null,
			recentDischarges: [],
			rainfall24hMm: 0,
			hasDischargeFeed: true,
			now: summerNow
		});
		expect(result.reason).toMatch(/no sewage in the last 48 hours/);
	});

	it('defaults to claiming the all-clear when the flag is absent', () => {
		const result = evaluateVerdict({
			classification: 'Good',
			latestSample: null,
			riskForecast: null,
			recentDischarges: [],
			rainfall24hMm: 0,
			now: summerNow
		});
		expect(result.reason).toMatch(/no sewage in the last 48 hours/);
	});
});

describe('evaluateVerdict — out of season', () => {
	it('records the closed season as a neutral factor, not a caution', () => {
		const result = evaluateVerdict({
			classification: 'Excellent',
			latestSample: null,
			riskForecast: null,
			recentDischarges: [],
			rainfall24hMm: 0,
			now: winterNow
		});
		const season = result.factors.find((f) => f.label === 'Bathing season');
		expect(season).toEqual({
			label: 'Bathing season',
			value: 'Closed until 15 May',
			weight: 'neutral'
		});
	});

	it('omits the season factor in season', () => {
		const result = evaluateVerdict({
			classification: 'Excellent',
			latestSample: null,
			riskForecast: null,
			recentDischarges: [],
			rainfall24hMm: 0,
			now: summerNow
		});
		expect(result.factors.find((f) => f.label === 'Bathing season')).toBeUndefined();
	});

	it('records the season factor on a No verdict too', () => {
		for (const classification of ['Poor', 'Closed'] as const) {
			const result = evaluateVerdict({
				classification,
				latestSample: null,
				riskForecast: null,
				recentDischarges: [],
				rainfall24hMm: 0,
				now: winterNow
			});
			expect(result.verdict).toBe('no');
			expect(result.factors.map((f) => f.label)).toContain('Bathing season');
		}
	});

	it('still returns No for Poor out of season', () => {
		const result = evaluateVerdict({
			classification: 'Poor',
			latestSample: null,
			riskForecast: null,
			recentDischarges: [],
			rainfall24hMm: 0,
			now: winterNow
		});
		expect(result.verdict).toBe('no');
		expect(result.reason).toMatch(/rated Poor/i);
	});

	it('still returns No for a live discharge out of season', () => {
		const result = evaluateVerdict({
			classification: 'Excellent',
			latestSample: null,
			riskForecast: null,
			recentDischarges: [discharge({ ongoing: true, distanceMetres: 1200 })],
			rainfall24hMm: 0,
			now: winterNow
		});
		expect(result.verdict).toBe('no');
	});

	it('still cautions on a Sufficient classification out of season', () => {
		const result = evaluateVerdict({
			classification: 'Sufficient',
			latestSample: null,
			riskForecast: null,
			recentDischarges: [],
			rainfall24hMm: 0,
			now: winterNow
		});
		expect(result.verdict).toBe('caution');
		expect(result.reason).toMatch(/Sufficient/);
	});
});

describe('evaluateVerdict — sample staleness', () => {
	it('lets a current high sample decide the verdict', () => {
		const result = evaluateVerdict({
			classification: 'Excellent',
			latestSample: { sampledAt: '2026-07-08T09:00:00Z', eColi: 1500 },
			riskForecast: null,
			recentDischarges: [],
			rainfall24hMm: 0,
			now: summerNow
		});
		expect(result.verdict).toBe('no');
	});

	it('does not hold a beach at No on a sample from last season', () => {
		const result = evaluateVerdict({
			classification: 'Excellent',
			latestSample: { sampledAt: '2025-09-24T09:00:00Z', eColi: 1500 },
			riskForecast: null,
			recentDischarges: [],
			rainfall24hMm: 0,
			now: winterNow
		});
		expect(result.verdict).toBe('yes');
	});

	it('still reports the stale reading as a negative factor', () => {
		const result = evaluateVerdict({
			classification: 'Excellent',
			latestSample: { sampledAt: '2025-09-24T09:00:00Z', eColi: 1500 },
			riskForecast: null,
			recentDischarges: [],
			rainfall24hMm: 0,
			now: winterNow
		});
		expect(result.factors).toContainEqual({
			label: 'Latest E. coli',
			value: '1500 cfu/100ml',
			weight: 'negative'
		});
	});

	it('ignores an elevated sample exactly one hour past the current window', () => {
		const sampledAt = '2026-07-01T09:00:00Z';
		const windowMs = _internals.SAMPLE_CURRENT_DAYS * 24 * 36e5;
		const inputs = {
			classification: 'Excellent' as const,
			latestSample: { sampledAt, eColi: 700 },
			riskForecast: null,
			recentDischarges: [],
			rainfall24hMm: 0
		};
		const onTheBoundary = new Date(Date.parse(sampledAt) + windowMs);
		const pastIt = new Date(Date.parse(sampledAt) + windowMs + 36e5);
		expect(evaluateVerdict({ ...inputs, now: onTheBoundary }).verdict).toBe('caution');
		expect(evaluateVerdict({ ...inputs, now: pastIt }).verdict).toBe('yes');
	});

	// The regulator profile can carry counts with no usable date, so a reading we
	// cannot age must keep deciding rather than be discarded as stale.
	it('still returns No for a high reading with no sample date', () => {
		for (const sampledAt of ['', 'not-a-date']) {
			const result = evaluateVerdict({
				classification: 'Excellent',
				latestSample: { sampledAt, eColi: 5000 },
				riskForecast: null,
				recentDischarges: [],
				rainfall24hMm: 0,
				now: summerNow
			});
			expect(result.verdict).toBe('no');
			expect(result.reason).toMatch(/5000/);
		}
	});

	it('still returns No for a high reading dated in the future', () => {
		const result = evaluateVerdict({
			classification: 'Excellent',
			latestSample: { sampledAt: '2027-07-10T09:00:00Z', eColi: 5000 },
			riskForecast: null,
			recentDischarges: [],
			rainfall24hMm: 0,
			now: summerNow
		});
		expect(result.verdict).toBe('no');
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
