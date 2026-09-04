import type { Country, LiveLocationData } from '$lib/data/types';

/**
 * What the page should say about how much live data stands behind this verdict.
 *
 * One function rather than a set of template conditions, because the branches
 * are mutually exclusive claims about the same thing and two of them once
 * contradicted each other: the Scottish notice asserted "none is showing for
 * this site right now" on a gate that was permanently true for every Scottish
 * site, so it would have denied a SEPA forecast at the very moment one arrived
 * and drove the verdict above it. Returning a single value makes that
 * impossible to reintroduce from the template.
 *
 * All four regulators publish something different, and no two of these notices
 * may ever be true at once:
 *   England and Wales  classification, weekly samples, daily forecast, CSO feed
 *   Scotland           classification, daily prediction at signed sites only
 *   Northern Ireland   no classification at all, a weekly indicator, and a
 *                      daily prediction at six sites
 */
export type CoverageNotice =
	/** Live forecast, sample and overflow feeds all exist for this site. */
	| 'full'
	/** Feeds exist and were checked, but there is nothing to report today. */
	| 'quiet'
	/** SEPA published today's prediction; nothing else is available in Scotland. */
	| 'sepa-forecast'
	/** SEPA runs predictions, but none is showing for this site. */
	| 'sepa-none'
	/** DAERA published today's prediction alongside its weekly indicator. */
	| 'daera-forecast'
	/** DAERA publishes only its weekly indicator for this site. */
	| 'daera-reading';

/** England and Wales are the two countries with live forecast and sample feeds. */
export function hasLiveSignals(country: Country): boolean {
	return country === 'England' || country === 'Wales';
}

export function coverageNotice(live: LiveLocationData): CoverageNotice {
	const nothingToReport = live.recentDischarges.length === 0 && !live.latestSample;

	if (hasLiveSignals(live.location.country)) {
		return nothingToReport ? 'quiet' : 'full';
	}
	// Outside England and Wales a prediction is the only live signal available,
	// so it decides the notice regardless of what else is missing.
	if (live.location.country === 'Scotland') {
		return live.riskForecast ? 'sepa-forecast' : 'sepa-none';
	}
	return live.riskForecast ? 'daera-forecast' : 'daera-reading';
}
