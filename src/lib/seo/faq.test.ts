import { describe, expect, it } from 'vitest';
import type { DischargeEvent, LiveLocationData, RecentSample } from '$lib/data/types';
import { buildFaq } from './faq';

const NOW = '2026-07-15T10:00:00Z';

function live(partial: Partial<LiveLocationData> = {}): LiveLocationData {
	return {
		location: {
			id: 'ea-1',
			slug: 'somewhere',
			name: 'Somewhere',
			country: 'England',
			lat: 50,
			lon: -1,
			classification: 'Excellent',
			source: { api: 'ea', sourceId: '1' }
		},
		classification: 'Excellent',
		latestSample: null,
		riskForecast: null,
		recentDischarges: [],
		hasDischargeFeed: true,
		rainfall24hMm: 0,
		sampleHistory: [],
		seaTemperatureC: null,
		verdict: {
			verdict: 'yes',
			headline: 'Yes.',
			reason: 'Excellent water quality and no sewage in the last 48 hours.',
			factors: [],
			fetchedAt: NOW,
			dataAge: 'fresh'
		},
		attribution: [],
		...partial
	};
}

function sewage(data: LiveLocationData): string {
	return buildFaq(data)[2].answer;
}

function quality(data: LiveLocationData): string {
	return buildFaq(data)[1].answer;
}

function discharge(partial: Partial<DischargeEvent> = {}): DischargeEvent {
	return {
		outfallName: 'Outfall A',
		distanceMetres: 1500,
		startedAt: '2026-07-15T08:00:00Z',
		ongoing: false,
		...partial
	};
}

describe('sewage answer', () => {
	// The regression that prompted this module: fetchRecentDischarges returns []
	// both when it looked and found nothing and when there was no feed to look
	// at, and every site outside England is the latter.
	it('never claims an all-clear when there is no feed for the site', () => {
		const answer = sewage(live({ hasDischargeFeed: false }));
		expect(answer).toMatch(/do not have a live storm-overflow feed/i);
		expect(answer).not.toMatch(/^No\./);
		expect(answer).not.toMatch(/No storm overflow within/);
	});

	it('claims the all-clear only when a feed was actually available', () => {
		expect(sewage(live({ hasDischargeFeed: true, recentDischarges: [] }))).toBe(
			'No. No storm overflow within ten kilometres of Somewhere has discharged in the last 48 hours.'
		);
	});

	it('counts a finished discharge as being in the last 48 hours', () => {
		expect(sewage(live({ recentDischarges: [discharge()] }))).toBe(
			'Yes. 1 storm overflow within ten kilometres of Somewhere: 1 in the last 48 hours.'
		);
	});

	// An ongoing spill is retained however long ago it started, so calling it
	// "in the last 48 hours" would misdate one that began a week ago.
	it('reports an ongoing discharge as happening now, not as recent', () => {
		const answer = sewage(live({ recentDischarges: [discharge({ ongoing: true })] }));
		expect(answer).toBe(
			'Yes. 1 storm overflow within ten kilometres of Somewhere: 1 discharging now.'
		);
		expect(answer).not.toMatch(/in the last 48 hours/);
	});

	it('separates ongoing from finished when both are present', () => {
		const answer = sewage(
			live({ recentDischarges: [discharge({ ongoing: true }), discharge(), discharge()] })
		);
		expect(answer).toBe(
			'Yes. 3 storm overflows within ten kilometres of Somewhere: 1 discharging now and 2 in the last 48 hours.'
		);
	});
});

describe('water quality answer', () => {
	function sample(partial: Partial<RecentSample>): RecentSample {
		return { sampledAt: '2026-07-10T09:00:00Z', ...partial };
	}

	it('attaches the unit to every reading, not just the last', () => {
		const answer = quality(live({ latestSample: sample({ eColi: 10, intestinalEnterococci: 13 }) }));
		expect(answer).toContain('10 cfu/100ml of E. coli and 13 cfu/100ml of intestinal enterococci');
	});

	it('handles a sample carrying only one parameter', () => {
		expect(quality(live({ latestSample: sample({ eColi: 10 }) }))).toContain(
			'showed 10 cfu/100ml of E. coli.'
		);
	});

	it('omits the sample clause entirely when it carries no readings', () => {
		expect(quality(live({ latestSample: sample({}) }))).not.toMatch(/most recent sample/);
	});

	it('drops the date rather than emitting a dangling comma when it is unusable', () => {
		const answer = quality(live({ latestSample: { sampledAt: '', eColi: 10 } }));
		expect(answer).toContain('The most recent sample showed');
		expect(answer).not.toContain(', taken ,');
	});

	// Without this the page can show "Yes." above a reading well over the No
	// threshold, with nothing saying the reading is months old.
	it('says so when a reading is too old to drive the verdict', () => {
		const answer = quality(
			live({ latestSample: { sampledAt: '2025-09-20T09:00:00Z', eColi: 1900 } })
		);
		expect(answer).toMatch(/too old to drive the verdict/);
	});

	it('does not add the caveat to a current reading', () => {
		expect(quality(live({ latestSample: sample({ eColi: 10 }) }))).not.toMatch(/too old/);
	});

	it('does not call an undated reading stale, matching the engine', () => {
		expect(quality(live({ latestSample: { sampledAt: '', eColi: 10 } }))).not.toMatch(/too old/);
	});

	it('claims no classification for New and Unknown rather than inventing one', () => {
		for (const classification of ['New', 'Unknown'] as const) {
			expect(quality(live({ classification }))).toMatch(/hold no annual classification/);
		}
	});

	// classify() folds "decommissioned" into Closed, so this must not assert a
	// present-tense closure to bathers.
	it('does not assert a present-tense closure for Closed', () => {
		const answer = quality(live({ classification: 'Closed' }));
		expect(answer).toBe('Somewhere is no longer listed as an open bathing water.');
	});
});

describe('buildFaq', () => {
	it('asks the three phrasings search actually uses', () => {
		expect(buildFaq(live()).map((f) => f.question)).toEqual([
			'Can you swim at Somewhere?',
			'What is the water quality like at Somewhere?',
			'Has there been sewage at Somewhere recently?'
		]);
	});

	it('gives every question a non-empty answer', () => {
		for (const item of buildFaq(live({ hasDischargeFeed: false, classification: 'Unknown' }))) {
			expect(item.answer.trim().length).toBeGreaterThan(0);
		}
	});
});
