/**
 * Human relative day for a sample or forecast date: "today", "yesterday",
 * "3 days ago", "2 weeks ago". Takes `now` so it is deterministic in tests.
 * Returns an empty string for an unparseable date.
 */
export function relativeDay(iso: string, now: number = Date.now()): string {
	const t = Date.parse(iso);
	if (!Number.isFinite(t)) return '';
	// Bucket by elapsed 24h windows rather than calendar days: simpler, no timezone
	// or DST edge cases, and near-midnight drift is immaterial for a weekly sample.
	const days = Math.floor((now - t) / 86_400_000);
	if (days <= 0) return 'today';
	if (days === 1) return 'yesterday';
	if (days < 14) return `${days} days ago`;
	const weeks = Math.round(days / 7);
	return `${weeks} weeks ago`;
}

/**
 * The most recent of the timestamps behind a page's content, ignoring anything
 * unparseable, with `fallback` when none of them survive.
 *
 * A verdict is recomputed on every ISR revalidation, so the render time says
 * only that the page was rebuilt. Google discounts a dateModified that always
 * reads "now" at crawl time, so the date offered is the newest reading the
 * verdict was actually drawn from.
 */
export function newestTimestamp(candidates: Array<string | undefined>, fallback: string): string {
	let newest = Number.NEGATIVE_INFINITY;

	for (const candidate of candidates) {
		if (!candidate) continue;
		const t = Date.parse(candidate);
		if (Number.isFinite(t) && t > newest) newest = t;
	}

	return newest === Number.NEGATIVE_INFINITY ? fallback : new Date(newest).toISOString();
}

/**
 * Every bathing water is in the UK and Vercel runs UTC, so the clock a visitor
 * reads has to be pinned to London rather than taken from the host.
 */
const UK = 'Europe/London';

function partsOf(iso: string, options: Intl.DateTimeFormatOptions) {
	const t = Date.parse(iso);
	if (!Number.isFinite(t)) return null;
	const parts = new Intl.DateTimeFormat('en-GB', { timeZone: UK, ...options }).formatToParts(
		new Date(t)
	);
	return Object.fromEntries(parts.map((p) => [p.type, p.value]));
}

/**
 * Hoisted, because constructing a formatter is the expensive part. A Welsh
 * location page parses two timestamps for each of ~113 nearby overflows, and
 * each parse resolves the offset twice: building a formatter per lookup cost
 * ~50ms a render against ~1.6ms shared.
 */
const londonOffsetFormat = new Intl.DateTimeFormat('en-GB', {
	timeZone: UK,
	timeZoneName: 'longOffset'
});

function londonOffsetMs(t: number): number {
	const parts = londonOffsetFormat.formatToParts(new Date(t));
	const name = parts.find((p) => p.type === 'timeZoneName')?.value ?? 'GMT';
	// longOffset gives "GMT+01:00" in summer and a bare "GMT" in winter.
	const m = /GMT([+-])(\d{2}):(\d{2})/.exec(name);
	if (!m) return 0;
	return (m[1] === '-' ? -1 : 1) * (Number(m[2]) * 3_600_000 + Number(m[3]) * 60_000);
}

/**
 * Parse a naive "2026-09-04T11:02:34" as London wall-clock time and return the
 * UTC instant. Several water-company feeds publish timestamps with no zone at
 * all, and JavaScript reads those as the host's local time, which on Vercel is
 * UTC: in summer that puts every event an hour into the future, so a spill that
 * started twenty minutes ago reads as not yet begun.
 *
 * A string carrying its own zone (a trailing Z or an explicit offset) is left
 * to Date.parse, so this only reinterprets the genuinely ambiguous ones.
 *
 * The offset is resolved twice because the offset itself depends on the instant
 * being resolved. The second pass settles the hour either side of a DST switch,
 * where the first guess can land in the wrong offset.
 */
export function parseLondonNaive(value: string): number | null {
	const trimmed = value.trim();
	if (/(?:Z|[+-]\d{2}:?\d{2})$/i.test(trimmed)) {
		const direct = Date.parse(trimmed);
		return Number.isFinite(direct) ? direct : null;
	}
	const m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/.exec(trimmed);
	if (!m) {
		const direct = Date.parse(trimmed);
		return Number.isFinite(direct) ? direct : null;
	}
	const guess = Date.UTC(
		Number(m[1]),
		Number(m[2]) - 1,
		Number(m[3]),
		Number(m[4]),
		Number(m[5]),
		Number(m[6] ?? 0)
	);
	if (!Number.isFinite(guess)) return null;
	const first = guess - londonOffsetMs(guess);
	return guess - londonOffsetMs(first);
}

/** "21:26", London time. Empty string for an unparseable date. */
export function londonClock(iso: string): string {
	const p = partsOf(iso, { hour: '2-digit', minute: '2-digit', hour12: false });
	return p ? `${p.hour}:${p.minute}` : '';
}

/** "Friday 14 August", London time. */
export function londonDate(iso: string): string {
	const p = partsOf(iso, { weekday: 'long', day: 'numeric', month: 'long' });
	return p ? `${p.weekday} ${p.day} ${p.month}` : '';
}

/** "14 August", London time, for use where the weekday would be noise. */
export function londonDayAndMonth(iso: string): string {
	const p = partsOf(iso, { day: 'numeric', month: 'long' });
	return p ? `${p.day} ${p.month}` : '';
}

/**
 * "14 August 2026", London time. Carries the year, so it stays unambiguous for
 * a sample taken in a previous bathing season.
 */
export function londonFullDate(iso: string): string {
	const p = partsOf(iso, { day: 'numeric', month: 'long', year: 'numeric' });
	return p ? `${p.day} ${p.month} ${p.year}` : '';
}

/** "Friday", London time, for a date too far out to call today or tomorrow. */
export function londonWeekday(iso: string): string {
	const p = partsOf(iso, { weekday: 'long' });
	return p ? p.weekday : '';
}

/** "2026-08-14", the London calendar date, for a <time datetime> attribute. */
export function londonIsoDate(iso: string): string {
	const p = partsOf(iso, { year: 'numeric', month: '2-digit', day: '2-digit' });
	return p ? `${p.year}-${p.month}-${p.day}` : '';
}

/**
 * "2026-08-14T21:26+01:00". Offset-aware rather than the raw UTC instant, so
 * the date component agrees with londonIsoDate on the same timestamp. At
 * 23:30 UTC in summer those two disagree by a day, which is exactly the
 * ambiguity a "...today" page cannot afford to hand a crawler.
 */
export function londonIsoDateTime(iso: string): string {
	const p = partsOf(iso, {
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
		hour: '2-digit',
		minute: '2-digit',
		hour12: false,
		timeZoneName: 'longOffset'
	});
	if (!p) return '';
	// longOffset gives "GMT+01:00" in summer and a bare "GMT" in winter.
	const offset = p.timeZoneName.replace('GMT', '') || '+00:00';
	return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}${offset}`;
}
