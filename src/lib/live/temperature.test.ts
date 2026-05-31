import { describe, expect, it } from 'vitest';
import { seaTemperatureBand } from './temperature';

describe('seaTemperatureBand', () => {
	it('flags very cold and cold water with a shock-risk note', () => {
		expect(seaTemperatureBand(9).tone).toBe('no');
		expect(seaTemperatureBand(9).note).toMatch(/cold-water shock/i);
		expect(seaTemperatureBand(13).tone).toBe('caution');
		expect(seaTemperatureBand(13).note).toMatch(/cold-water shock/i);
	});

	it('treats 15°C and above as no longer a shock risk', () => {
		expect(seaTemperatureBand(16).note).toBeUndefined();
		expect(seaTemperatureBand(16).label).toBe('Cool');
		expect(seaTemperatureBand(16).tone).toBe('neutral');
		expect(seaTemperatureBand(19).tone).toBe('yes');
		expect(seaTemperatureBand(22).label).toBe('Warm');
	});

	it('places boundaries at 12, 15, 18 and 21', () => {
		expect(seaTemperatureBand(11.9).label).toBe('Very cold');
		expect(seaTemperatureBand(12).label).toBe('Cold');
		expect(seaTemperatureBand(15).label).toBe('Cool');
		expect(seaTemperatureBand(18).label).toBe('Mild');
		expect(seaTemperatureBand(21).label).toBe('Warm');
	});
});
