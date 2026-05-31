import { describe, expect, it } from 'vitest';
import { relativeDay } from './time';

const now = Date.parse('2026-05-21T10:00:00Z');

describe('relativeDay', () => {
	it('reports same-day and adjacent days', () => {
		expect(relativeDay('2026-05-21T08:00:00Z', now)).toBe('today');
		expect(relativeDay('2026-05-20T08:00:00Z', now)).toBe('yesterday');
		expect(relativeDay('2026-05-18T10:00:00Z', now)).toBe('3 days ago');
	});

	it('switches to weeks beyond a fortnight', () => {
		expect(relativeDay('2026-05-01T10:00:00Z', now)).toBe('3 weeks ago');
	});

	it('treats a future date as today and an invalid date as empty', () => {
		expect(relativeDay('2026-05-22T10:00:00Z', now)).toBe('today');
		expect(relativeDay('not a date', now)).toBe('');
	});

	it('handles the timezone-naive timestamp shape the regulators return', () => {
		// EA/NRW sampleDateTime has no timezone suffix; parsed as local time.
		expect(relativeDay('2026-05-18T10:00:00', Date.parse('2026-05-21T10:00:00'))).toBe('3 days ago');
	});
});
