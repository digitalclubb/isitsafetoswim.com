import { describe, expect, it } from 'vitest';
import { parseSepaForecasts } from './sepa';

const NOW = new Date('2026-07-15T12:00:00Z');

function feature(description: string, current_forecast: unknown, last_updated: unknown) {
	return { attributes: { description, current_forecast, last_updated } };
}

/** Two hours old: comfortably inside the freshness window. */
const FRESH = NOW.getTime() - 2 * 60 * 60 * 1000;

describe('parseSepaForecasts', () => {
	it('maps a Good prediction to normal risk', () => {
		const map = parseSepaForecasts(
			{ features: [feature('Portobello (Central)', 'Good', FRESH)] },
			NOW
		);
		expect(map.get('portobellocentral')?.riskLevel).toBe('normal');
	});

	it('maps a Poor prediction to increased risk', () => {
		const map = parseSepaForecasts({ features: [feature('Eyemouth', 'Poor', FRESH)] }, NOW);
		expect(map.get('eyemouth')?.riskLevel).toBe('increased');
	});

	it('drops a prediction older than a publication cycle', () => {
		// The live layer has sat on 19 May since the season opened. Serving that
		// as today's forecast would put a months-old Poor on the page.
		const stale = NOW.getTime() - 120 * 24 * 60 * 60 * 1000;
		const map = parseSepaForecasts({ features: [feature('Eyemouth', 'Poor', stale)] }, NOW);
		expect(map.size).toBe(0);
	});

	it('keeps a prediction right up to the edge of the window', () => {
		const edge = NOW.getTime() - 25 * 60 * 60 * 1000;
		const map = parseSepaForecasts({ features: [feature('Ayr (South Beach)', 'Good', edge)] }, NOW);
		expect(map.size).toBe(1);
	});

	it('drops a future timestamp, which is as broken as an ancient one', () => {
		const ahead = NOW.getTime() + 60 * 60 * 1000;
		const map = parseSepaForecasts({ features: [feature('Irvine', 'Good', ahead)] }, NOW);
		expect(map.size).toBe(0);
	});

	it('drops the epoch-zero row the layer carries for an unpredicted site', () => {
		const map = parseSepaForecasts({ features: [feature('Southerness', null, 0)] }, NOW);
		expect(map.size).toBe(0);
	});

	it('drops a row whose forecast word it does not recognise', () => {
		const map = parseSepaForecasts(
			{ features: [feature('Nairn (East)', 'Unavailable', FRESH)] },
			NOW
		);
		expect(map.size).toBe(0);
	});

	it('tolerates an empty or malformed response', () => {
		expect(parseSepaForecasts({}, NOW).size).toBe(0);
		expect(parseSepaForecasts({ features: [] }, NOW).size).toBe(0);
	});
});
