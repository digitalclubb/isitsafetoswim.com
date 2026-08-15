import spillHistoryJson from '$data/spill-history.json';

/**
 * The per-bathing-water storm-overflow record, compiled from the Environment
 * Agency's EDM annual returns by scripts/build-spill-history.mjs.
 *
 * Two figures, and the difference between them is the whole point. `attributed`
 * counts the overflows the EA itself links to this bathing water, so it follows
 * the water: an upstream overflow miles inland counts, a nearby one draining
 * elsewhere does not. `nearby` counts monitored overflows within 10km, which is
 * geography rather than hydrology and reads far too high in a city. Only the
 * attributed figure is safe to state as this beach's own record.
 *
 * England only, because the EDM return is an England publication.
 */
export interface SpillYear {
	year: number;
	overflows: number;
	spills: number;
	/**
	 * Overflows the return listed without a spill count, meaning not monitored
	 * that year rather than never spilling. Present only when non-zero.
	 */
	unmonitored?: number;
}

export interface SpillRecord {
	attributed: SpillYear[];
	nearby: SpillYear[];
}

interface SpillHistoryFile {
	generatedAt: string;
	source: string;
	licence: string;
	coverage: string;
	radiusMetres: number;
	years: number[];
	bySlug: Record<string, SpillRecord>;
}

const history = spillHistoryJson as unknown as SpillHistoryFile;

export function getSpillHistory(slug: string): SpillRecord | null {
	const record = history.bySlug[slug];
	if (!record) return null;
	return record.attributed.length > 0 || record.nearby.length > 0 ? record : null;
}

export function getSpillHistoryMeta(): Pick<
	SpillHistoryFile,
	'source' | 'licence' | 'years' | 'radiusMetres' | 'generatedAt'
> {
	return {
		source: history.source,
		licence: history.licence,
		years: history.years,
		radiusMetres: history.radiusMetres,
		generatedAt: history.generatedAt
	};
}

/**
 * How much of a year's record is missing rather than zero. Above this share the
 * year is not a fair comparison: the 2021 return left 847 overflows without a
 * count, and treating those as no spills turns a monitoring gap into an
 * apparent rise.
 */
const UNMONITORED_LIMIT = 0.1;

function isComparable(year: SpillYear): boolean {
	return (year.unmonitored ?? 0) / Math.max(1, year.overflows) <= UNMONITORED_LIMIT;
}

/**
 * The years fit to put in front of a reader, oldest first. A year missing a
 * tenth of its counts reads as a dip that never happened, so it is left out of
 * the chart as well as the trend: a bar and a percentage drawn from different
 * sets of years would contradict each other on the same screen.
 */
export function comparableSpillYears(years: SpillYear[]): SpillYear[] {
	return [...years].sort((a, b) => a.year - b.year).filter(isComparable);
}

/**
 * The change between the first and last comparable year on record, as a
 * percentage of the first. Null when there is nothing to compare, when the
 * earlier year was zero and any increase would divide by it, or when either end
 * of the comparison is too patchily monitored to stand behind.
 */
export function spillTrend(
	years: SpillYear[]
): { from: SpillYear; to: SpillYear; changePct: number } | null {
	const sorted = comparableSpillYears(years);
	if (sorted.length < 2) return null;
	const from = sorted[0];
	const to = sorted[sorted.length - 1];
	if (from.spills === 0) return null;
	return { from, to, changePct: Math.round(((to.spills - from.spills) / from.spills) * 100) };
}

/** The most recent year on record, which is the figure the page leads with. */
export function latestSpillYear(years: SpillYear[]): SpillYear | null {
	if (years.length === 0) return null;
	return years.reduce((latest, year) => (year.year > latest.year ? year : latest));
}
