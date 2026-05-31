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
