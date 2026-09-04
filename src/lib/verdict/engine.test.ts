import { describe, expect, it } from 'vitest';
import type { DischargeEvent } from '$lib/data/types';
import { _internals, bathingSeasonActive, decideAt, evaluateVerdict, seasonLabels } from './engine';

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

describe('bathingSeasonActive, per country', () => {
	// England and Wales run 15 May to 30 September under the Bathing Water
	// Regulations 2013. Scotland (SSI 2008/170) and Northern Ireland run
	// 1 June to 15 September, a fortnight shorter at each end.
	const lateMay = new Date('2026-05-20T12:00:00Z');
	const earlyJune = new Date('2026-06-05T12:00:00Z');
	const lateSeptember = new Date('2026-09-20T12:00:00Z');
	const midSeptember = new Date('2026-09-10T12:00:00Z');

	it('opens England and Wales on 15 May', () => {
		expect(bathingSeasonActive(new Date('2026-05-14T12:00:00Z'), 'England')).toBe(false);
		expect(bathingSeasonActive(new Date('2026-05-15T12:00:00Z'), 'England')).toBe(true);
		expect(bathingSeasonActive(lateMay, 'Wales')).toBe(true);
	});

	it('keeps Scotland and Northern Ireland closed in late May', () => {
		expect(bathingSeasonActive(lateMay, 'Scotland')).toBe(false);
		expect(bathingSeasonActive(lateMay, 'Northern Ireland')).toBe(false);
	});

	it('opens Scotland and Northern Ireland on 1 June', () => {
		expect(bathingSeasonActive(new Date('2026-05-31T12:00:00Z'), 'Scotland')).toBe(false);
		expect(bathingSeasonActive(new Date('2026-06-01T12:00:00Z'), 'Scotland')).toBe(true);
		expect(bathingSeasonActive(earlyJune, 'Northern Ireland')).toBe(true);
	});

	it('closes Scotland and Northern Ireland on 15 September', () => {
		expect(bathingSeasonActive(midSeptember, 'Scotland')).toBe(true);
		expect(bathingSeasonActive(new Date('2026-09-15T12:00:00Z'), 'Scotland')).toBe(true);
		expect(bathingSeasonActive(new Date('2026-09-16T12:00:00Z'), 'Scotland')).toBe(false);
		expect(bathingSeasonActive(lateSeptember, 'Northern Ireland')).toBe(false);
	});

	it('keeps England and Wales open to 30 September', () => {
		expect(bathingSeasonActive(lateSeptember, 'England')).toBe(true);
		expect(bathingSeasonActive(new Date('2026-09-30T12:00:00Z'), 'England')).toBe(true);
		expect(bathingSeasonActive(new Date('2026-10-01T12:00:00Z'), 'England')).toBe(false);
	});

	it('defaults to the England and Wales season with no country given', () => {
		expect(bathingSeasonActive(lateSeptember)).toBe(true);
		expect(bathingSeasonActive(lateMay)).toBe(true);
	});

	it('names the right reopening date per country', () => {
		expect(seasonLabels('England')).toEqual({ opens: '15 May', closes: '30 September' });
		expect(seasonLabels('Scotland')).toEqual({ opens: '1 June', closes: '15 September' });
	});

	it('tells a Scottish site the season is closed in late September', () => {
		// The out-of-season factor must follow the country, not England's dates.
		const result = evaluateVerdict({
			classification: 'Excellent',
			latestSample: null,
			riskForecast: null,
			recentDischarges: [],
			rainfall24hMm: 0,
			country: 'Scotland',
			now: lateSeptember
		});
		const season = result.factors.find((f) => f.label === 'Bathing season');
		expect(season?.value).toBe('Closed until 1 June');
	});
});

describe('currentAssessment, where a regulator publishes no classification', () => {
	const base = {
		classification: 'Unknown' as const,
		latestSample: null,
		riskForecast: null,
		recentDischarges: [],
		rainfall24hMm: null,
		hasDischargeFeed: false,
		country: 'Northern Ireland' as const,
		now: summerNow
	};
	const recently = new Date(summerNow.getTime() - 3 * 24 * 36e5).toISOString();
	const longAgo = new Date(summerNow.getTime() - 200 * 24 * 36e5).toISOString();

	it('returns No when the regulator advises against bathing', () => {
		const r = evaluateVerdict({
			...base,
			currentAssessment: {
				level: 'advised-against',
				label: 'Advised against bathing',
				assessedAt: recently
			}
		});
		expect(r.verdict).toBe('no');
		expect(r.reason).toBe('The regulator advises against bathing here.');
	});

	it('still returns No on advice against bathing months later', () => {
		// A warning that lapses quietly is worse than one shown with its date.
		const r = evaluateVerdict({
			...base,
			currentAssessment: {
				level: 'advised-against',
				label: 'Advised against bathing',
				assessedAt: longAgo
			}
		});
		expect(r.verdict).toBe('no');
	});

	it('lets a fresh clean reading stand in for the missing classification', () => {
		const r = evaluateVerdict({
			...base,
			currentAssessment: { level: 'good', label: 'Excellent', assessedAt: recently }
		});
		expect(r.verdict).toBe('yes');
		expect(r.reason).toContain('Excellent');
		// It must never be reported as an annual classification, which is the
		// claim that made 29 pages wrong in the first place.
		expect(r.reason).not.toContain('annual classification');
	});

	it('reports the regulator’s own word, not the internal level', () => {
		const r = evaluateVerdict({
			...base,
			currentAssessment: { level: 'satisfactory', label: 'Satisfactory', assessedAt: recently }
		});
		expect(r.factors.some((f) => f.value.startsWith('Satisfactory'))).toBe(true);
	});

	it('stops a stale reading deciding, and says why', () => {
		const r = evaluateVerdict({
			...base,
			currentAssessment: { level: 'good', label: 'Excellent', assessedAt: longAgo }
		});
		expect(r.verdict).toBe('caution');
		expect(r.reason).toContain('No annual classification is published');
	});

	it('still cautions an unrated site with no reading at all', () => {
		const r = evaluateVerdict({ ...base, currentAssessment: null });
		expect(r.verdict).toBe('caution');
		expect(r.reason).toBe('No verified classification for this site yet.');
	});

	it('never lets a clean reading override a live discharge', () => {
		const r = evaluateVerdict({
			...base,
			hasDischargeFeed: true,
			recentDischarges: [
				{
					outfallName: 'Outfall',
					distanceMetres: 500,
					startedAt: new Date(summerNow.getTime() - 36e5).toISOString(),
					ongoing: true
				}
			],
			currentAssessment: { level: 'good', label: 'Excellent', assessedAt: recently }
		});
		expect(r.verdict).toBe('no');
	});
});

describe('classification factor where none is published', () => {
	const base = {
		classification: 'Unknown' as const,
		latestSample: null,
		riskForecast: null,
		recentDischarges: [],
		rainfall24hMm: null,
		hasDischargeFeed: false,
		country: 'Northern Ireland' as const,
		now: summerNow
	};
	const recently = new Date(summerNow.getTime() - 3 * 24 * 36e5).toISOString();

	it('drops the classification row when the regulator publishes none', () => {
		// "Annual classification: Unknown" is noise where no classification exists,
		// and it sat directly under a No driven by the regulator's own advice.
		const r = evaluateVerdict({
			...base,
			currentAssessment: { level: 'good', label: 'Excellent', assessedAt: recently }
		});
		expect(r.factors.some((f) => f.label === 'Annual classification')).toBe(false);
	});

	it('drops it on the advice-against branch too', () => {
		const r = evaluateVerdict({
			...base,
			currentAssessment: {
				level: 'advised-against',
				label: 'Advised against bathing',
				assessedAt: recently
			}
		});
		expect(r.factors.some((f) => f.label === 'Annual classification')).toBe(false);
		expect(r.factors.some((f) => f.label === 'Regulator advice')).toBe(true);
	});

	it('keeps the classification row for a site that genuinely has one', () => {
		const r = evaluateVerdict({
			...base,
			classification: 'Excellent',
			country: 'England',
			currentAssessment: null
		});
		expect(r.factors.some((f) => f.label === 'Annual classification')).toBe(true);
	});

	it('keeps it for an unclassified site with no regulator reading either', () => {
		const r = evaluateVerdict({ ...base, country: 'England', currentAssessment: null });
		expect(r.factors.some((f) => f.label === 'Annual classification')).toBe(true);
	});
});

describe('the regulator reading appears on every verdict, not only the caution path', () => {
	const recently = new Date(summerNow.getTime() - 3 * 24 * 36e5).toISOString();
	const longAgo = new Date(summerNow.getTime() - 200 * 24 * 36e5).toISOString();
	const base = {
		classification: 'Unknown' as const,
		latestSample: null,
		riskForecast: null,
		recentDischarges: [],
		rainfall24hMm: null,
		hasDischargeFeed: false,
		country: 'Northern Ireland' as const,
		now: summerNow
	};

	function reading(factors: { label: string; value: string; weight: string }[]) {
		return factors.find(
			(f) => f.label === 'Latest regulator reading' || f.label === 'Regulator advice'
		);
	}

	it('carries the advice through a discharge-driven No', () => {
		// The site is held at No by a spill, but standing advice against bathing
		// must still be visible. Losing it here is the under-warning class this
		// whole change exists to close.
		const r = evaluateVerdict({
			...base,
			hasDischargeFeed: true,
			recentDischarges: [
				{
					outfallName: 'Outfall',
					distanceMetres: 400,
					startedAt: new Date(summerNow.getTime() - 36e5).toISOString(),
					ongoing: true
				}
			],
			currentAssessment: {
				level: 'advised-against',
				label: 'Advised against bathing',
				assessedAt: recently
			}
		});
		expect(r.verdict).toBe('no');
		expect(reading(r.factors)?.label).toBe('Regulator advice');
	});

	it('shows a stale reading, dated, rather than showing nothing at all', () => {
		const r = evaluateVerdict({
			...base,
			currentAssessment: { level: 'good', label: 'Excellent', assessedAt: longAgo }
		});
		expect(r.verdict).toBe('caution');
		const row = reading(r.factors);
		expect(row?.value).toContain('Excellent');
		expect(row?.value).toContain('2025');
		expect(row?.weight).toBe('neutral');
	});

	it('dates a current reading too', () => {
		const r = evaluateVerdict({
			...base,
			currentAssessment: { level: 'good', label: 'Excellent', assessedAt: recently }
		});
		expect(reading(r.factors)?.weight).toBe('positive');
		expect(reading(r.factors)?.value).toMatch(/Excellent, \d/);
	});

	it('adds no reading row for a site that has a real classification', () => {
		const r = evaluateVerdict({
			...base,
			classification: 'Excellent',
			country: 'England',
			currentAssessment: null
		});
		expect(reading(r.factors)).toBeUndefined();
	});

	it('treats an undated reading as stale rather than as a permanent Yes', () => {
		// An undated sample fails safe by continuing to drive a No. An undated
		// clean reading would fail open, holding a site at Yes for ever.
		const r = evaluateVerdict({
			...base,
			currentAssessment: { level: 'good', label: 'Excellent' }
		});
		expect(r.verdict).toBe('caution');
		expect(r.reason).toContain('No annual classification is published');
	});
});
