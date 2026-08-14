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
