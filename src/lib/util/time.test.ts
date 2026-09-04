import { describe, expect, it } from 'vitest';
import {
	londonClock,
	londonDate,
	londonDayAndMonth,
	londonFullDate,
	londonIsoDate,
	londonIsoDateTime,
	newestTimestamp,
	parseLondonNaive,
	relativeDay
} from './time';

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

// Vercel runs UTC, so every case below is written as a UTC instant and asserted
// against what a visitor in the UK should see.
describe('London formatters', () => {
	const summerEvening = '2026-08-14T20:26:43.452Z';
	const summerMidnight = '2026-08-14T23:30:00.000Z';
	const winterMorning = '2026-01-15T09:05:00.000Z';

	it('renders the clock in British Summer Time, not UTC', () => {
		expect(londonClock(summerEvening)).toBe('21:26');
		expect(londonClock(winterMorning)).toBe('09:05');
	});

	it('renders the date a UK reader would recognise', () => {
		expect(londonDate(summerEvening)).toBe('Friday 14 August');
		expect(londonDayAndMonth(summerEvening)).toBe('14 August');
		expect(londonFullDate(summerEvening)).toBe('14 August 2026');
	});

	// A sample can be months old out of season, so its year has to be on it.
	it('carries the year, and rolls it over at UK midnight', () => {
		expect(londonFullDate(summerMidnight)).toBe('15 August 2026');
		expect(londonFullDate('2025-12-31T23:30:00.000Z')).toBe('31 December 2025');
	});

	it('rolls the date over at UK midnight, not UTC midnight', () => {
		expect(londonClock(summerMidnight)).toBe('00:30');
		expect(londonDate(summerMidnight)).toBe('Saturday 15 August');
		expect(londonIsoDate(summerMidnight)).toBe('2026-08-15');
	});

	// The whole point of the machine-readable date is telling a crawler which
	// day the verdict belongs to, so the two attributes must never disagree.
	it('keeps the datetime attributes agreeing on the day across BST midnight', () => {
		expect(londonIsoDateTime(summerMidnight)).toBe('2026-08-15T00:30+01:00');
		expect(londonIsoDateTime(summerMidnight).slice(0, 10)).toBe(londonIsoDate(summerMidnight));
	});

	it('carries the right offset in each half of the year', () => {
		expect(londonIsoDateTime(summerEvening)).toBe('2026-08-14T21:26+01:00');
		expect(londonIsoDateTime(winterMorning)).toBe('2026-01-15T09:05+00:00');
	});

	it('returns an empty string rather than throwing on a bad date', () => {
		for (const format of [
			londonClock,
			londonDate,
			londonDayAndMonth,
			londonFullDate,
			londonIsoDate,
			londonIsoDateTime
		]) {
			expect(format('not a date')).toBe('');
		}
	});
});

describe('newestTimestamp', () => {
	const fallback = '2026-08-14T20:00:00.000Z';

	it('picks the most recent reading behind the page', () => {
		expect(newestTimestamp(['2026-08-10T09:00:00.000Z', '2026-08-13T18:30:00.000Z'], fallback)).toBe(
			'2026-08-13T18:30:00.000Z'
		);
	});

	it('skips missing and unparseable entries', () => {
		expect(newestTimestamp([undefined, 'not a date', '2026-08-11T00:00:00.000Z'], fallback)).toBe(
			'2026-08-11T00:00:00.000Z'
		);
	});

	it('falls back when nothing usable is offered', () => {
		expect(newestTimestamp([], fallback)).toBe(fallback);
		expect(newestTimestamp([undefined, 'nonsense'], fallback)).toBe(fallback);
	});
});

describe('parseLondonNaive', () => {
	it('reads a naive summer timestamp as BST, not UTC', () => {
		// Welsh Water publishes "2026-09-04T11:02:34" meaning 11:02 UK time.
		// Read as UTC it would sit an hour in the future all summer.
		expect(parseLondonNaive('2026-09-04T11:02:34')).toBe(Date.parse('2026-09-04T10:02:34Z'));
	});

	it('reads a naive winter timestamp as GMT', () => {
		expect(parseLondonNaive('2026-01-15T09:30:00')).toBe(Date.parse('2026-01-15T09:30:00Z'));
	});

	it('leaves a timestamp that carries its own zone alone', () => {
		expect(parseLondonNaive('2026-09-04T11:02:34Z')).toBe(Date.parse('2026-09-04T11:02:34Z'));
		expect(parseLondonNaive('2026-09-04T11:02:34+02:00')).toBe(Date.parse('2026-09-04T09:02:34Z'));
	});

	it('accepts a space separator and a missing seconds field', () => {
		expect(parseLondonNaive('2026-09-04 11:02')).toBe(Date.parse('2026-09-04T10:02:00Z'));
	});

	it('returns null for something unparseable', () => {
		expect(parseLondonNaive('not a date')).toBeNull();
		expect(parseLondonNaive('')).toBeNull();
	});
});
