import { describe, expect, it } from 'vitest';
import { parseDaeraPredictions } from './daera';

const NOW = new Date('2026-09-04T11:00:00Z');
/** DAERA stamps the day at local midnight, so today's row reads as the 3rd in UTC. */
const TODAY = Date.parse('2026-09-03T23:00:00Z');
const YESTERDAY = Date.parse('2026-09-02T23:00:00Z');

function row(over: Record<string, unknown> = {}) {
	return {
		attributes: {
			Unique_Site_ID_Code: 30015,
			pm_in_scope: 'Yes',
			pm_current_prediction: 'Normal Risk',
			pm_current_prediction_for: TODAY,
			pm_publish_override: 'No',
			...over
		}
	};
}

describe('parseDaeraPredictions', () => {
	it('reads today’s normal prediction', () => {
		const map = parseDaeraPredictions({ features: [row()] }, NOW);
		expect(map.get('30015')?.riskLevel).toBe('normal');
	});

	it('reads an increased prediction', () => {
		const map = parseDaeraPredictions(
			{ features: [row({ pm_current_prediction: 'Increased Risk' })] },
			NOW
		);
		expect(map.get('30015')?.riskLevel).toBe('increased');
	});

	it('refuses yesterday’s prediction', () => {
		// The row carries the day it applies to, so an unchanged layer must never
		// be served as today's answer however recently it was edited.
		const map = parseDaeraPredictions(
			{ features: [row({ pm_current_prediction_for: YESTERDAY })] },
			NOW
		);
		expect(map.size).toBe(0);
	});

	it('skips a site outside the modelling programme', () => {
		const map = parseDaeraPredictions({ features: [row({ pm_in_scope: 'No' })] }, NOW);
		expect(map.size).toBe(0);
	});

	it('respects DAERA withholding the modelled value', () => {
		const map = parseDaeraPredictions({ features: [row({ pm_publish_override: 'Yes' })] }, NOW);
		expect(map.size).toBe(0);
	});

	it('drops a prediction word it does not recognise rather than guessing', () => {
		const map = parseDaeraPredictions(
			{ features: [row({ pm_current_prediction: 'Under review' })] },
			NOW
		);
		expect(map.size).toBe(0);
	});

	it('tolerates a missing or malformed response', () => {
		expect(parseDaeraPredictions({}, NOW).size).toBe(0);
		expect(
			parseDaeraPredictions({ features: [row({ pm_current_prediction_for: null })] }, NOW).size
		).toBe(0);
		expect(parseDaeraPredictions({ features: [row({ Unique_Site_ID_Code: null })] }, NOW).size).toBe(
			0
		);
	});
});
