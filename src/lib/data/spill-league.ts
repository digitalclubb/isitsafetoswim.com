import { getAllLocations } from './locations';
import { getAllPlaces, type Place } from './places';
import {
	comparableSpillYears,
	getSpillHistory,
	getSpillHistoryMeta,
	latestSpillYear,
	type SpillYear,
	spillTrend
} from './spill-history';
import type { Location } from './types';

/**
 * Sewage league tables over the five-year EDM record: which bathing waters had
 * the most storm-overflow spills, per country and per region.
 *
 * Ranked on the `attributed` figure only. That is the set of overflows the EA
 * itself links to the bathing water, so it follows the sewer network rather
 * than a radius. The `nearby` count cannot be ranked on: it is geography, and
 * it puts 267 urban overflows against a lake in Bristol that they do not drain
 * into. A table headed "worst for sewage" has to be defensible per row.
 *
 * A site with no attributed record is left out rather than ranked at zero. The
 * EA attributes overflows to 322 of 464 English sites; the rest have no record,
 * which is not the same as a clean one, and the pages say how many are missing.
 *
 * England only, because the EDM return is an England publication.
 */
const REGION_MIN = 5;

export interface SpillLeagueEntry {
	location: Location;
	/** Spills in the ranked year. */
	spills: number;
	/** Overflows the EA attributes to this bathing water. */
	overflows: number;
	/** Change across the comparable years on record, as a percentage. */
	changePct: number | null;
	/**
	 * The year `changePct` is measured from. It varies by site, because a year
	 * too patchily monitored to compare is dropped from that site's record: 2021
	 * left 847 overflows uncounted, so many sites start from 2022 or later.
	 */
	changeFrom: number | null;
}

export interface SpillLeague {
	place: Place;
	parent: Place | null;
	/** The year every row is ranked on. */
	year: number;
	entries: SpillLeagueEntry[];
	/** Sites ranked in `year`, which is what the table actually lists. */
	ranked: number;
	/** Sites carrying an attributed record at all, in any year. */
	withRecord: number;
	/**
	 * Sites that hold a record but have no comparable figure for `year`, so they
	 * are missing from the table without being missing from the data.
	 *
	 * The two causes are kept apart because only one of them is an operator's
	 * doing, and conflating them names companies for something they did not do.
	 * `silentOperators` is the strong claim: an operator with absent sites here
	 * and not one ranked site anywhere, meaning its return links no overflow to
	 * any bathing water at all. For 2025 that is Yorkshire Water alone. Every
	 * other absent site is an individual gap, and the other operators in the
	 * list filed normally: Anglian has 32 ranked sites, Wessex 30, United
	 * Utilities 28, Northumbrian 27.
	 */
	absent: {
		count: number;
		silentOperators: Array<{ name: string; count: number; previousYearCount: number }>;
		/** Absent for a per-site reason rather than a whole-return omission. */
		otherReasons: number;
	};
	/** Bathing waters in this place altogether. */
	total: number;
	/** Total spills across the ranked rows. */
	totalSpills: number;
	childRegions: Place[];
	generatedAt: string;
}

function isEnglish(place: Place): boolean {
	return place.country === 'England';
}

function locationsForPlace(place: Place): Location[] {
	const all = getAllLocations();
	if (place.kind === 'country') return all.filter((l) => l.country === place.country);
	return all.filter((l) => l.country === place.country && l.region === place.name);
}

/**
 * Rank one place's bathing waters by spills in the most recent comparable year.
 *
 * Every row is the same year, so no beach is compared against a different year
 * to the one above it. A site whose record stops earlier drops out of the table
 * rather than being carried in on an older figure.
 */
function rank(
	locations: Location[]
): { year: number; entries: SpillLeagueEntry[]; withRecord: number } | null {
	const withRecord: Array<{
		location: Location;
		attributed: SpillYear[];
		years: SpillYear[];
	}> = [];
	for (const location of locations) {
		const record = getSpillHistory(location.slug);
		if (!record) continue;
		const years = comparableSpillYears(record.attributed);
		if (years.length === 0) continue;
		withRecord.push({ location, attributed: record.attributed, years });
	}
	if (withRecord.length === 0) return null;

	// The newest year anyone has a comparable figure for. Every row is then that
	// same year, and a site whose record stops earlier is left out rather than
	// silently compared against a different year to the rows above it.
	const year = Math.max(...withRecord.map((r) => latestSpillYear(r.years)?.year ?? 0));
	if (!year) return null;

	const entries: SpillLeagueEntry[] = [];
	for (const { location, attributed, years } of withRecord) {
		const row = years.find((y) => y.year === year);
		if (!row) continue;
		const trend = spillTrend(attributed);
		entries.push({
			location,
			spills: row.spills,
			overflows: row.overflows,
			changePct: trend?.changePct ?? null,
			changeFrom: trend?.from.year ?? null
		});
	}
	entries.sort(
		(a, b) => b.spills - a.spills || a.location.name.localeCompare(b.location.name, 'en-GB')
	);
	return { year, entries, withRecord: withRecord.length };
}

/**
 * The regions that earn their own league page: enough ranked sites to read as a
 * table rather than a list of one or two.
 *
 * England is deliberately absent. It is the hub at `/beaches/sewage`, which
 * carries the full national table; giving it a second URL under `[place]` would
 * ship the same rows, the same title and a competing canonical.
 */
export function getSpillLeaguePlaces(): Place[] {
	return getAllPlaces()
		.filter((place) => isEnglish(place) && place.kind === 'region')
		.filter((place) => (rank(locationsForPlace(place))?.entries.length ?? 0) >= REGION_MIN)
		.slice()
		.sort((a, b) => a.name.localeCompare(b.name, 'en-GB'));
}

/**
 * Operators that appear among the absent sites and have not one ranked site,
 * meaning their return for this year links no overflow to any bathing water.
 * That is a checkable fact about a return, and the only absence claim strong
 * enough to attach a company name to.
 *
 * `previousYearCount` is how many of those sites the same operator did link the
 * year before, which is what turns "no data" into "stopped reporting".
 */
function findSilentOperators(
	missing: Location[],
	ranked: SpillLeagueEntry[],
	year: number
): Array<{ name: string; count: number; previousYearCount: number }> {
	const rankedOperators = new Set(
		ranked.map((e) => e.location.sewerageUndertaker).filter(Boolean) as string[]
	);
	const tally = new Map<string, Location[]>();
	for (const l of missing) {
		const name = l.sewerageUndertaker;
		if (!name || rankedOperators.has(name)) continue;
		tally.set(name, [...(tally.get(name) ?? []), l]);
	}
	return [...tally.entries()]
		.map(([name, sites]) => ({
			name,
			count: sites.length,
			previousYearCount: sites.filter((l) =>
				comparableSpillYears(getSpillHistory(l.slug)?.attributed ?? []).some((y) => y.year === year - 1)
			).length
		}))
		.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'en-GB'));
}

export function getSpillLeague(slug: string): SpillLeague | null {
	const place = getAllPlaces().find((p) => p.slug === slug);
	if (!place || !isEnglish(place)) return null;

	const locations = locationsForPlace(place);
	const ranked = rank(locations);
	if (!ranked) return null;

	const listed = new Set(ranked.entries.map((e) => e.location.slug));
	const missing = locations.filter((l) => {
		if (listed.has(l.slug)) return false;
		const record = getSpillHistory(l.slug);
		return Boolean(record) && comparableSpillYears(record?.attributed ?? []).length > 0;
	});

	// Only ever asserted nationally. An operator can have no ranked site inside
	// one region simply because the region is small, so the same test on a
	// regional page would accuse a company that filed perfectly well.
	const silentOperators =
		place.kind === 'country' ? findSilentOperators(missing, ranked.entries, ranked.year) : [];
	const namedByOperator = silentOperators.reduce((sum, o) => sum + o.count, 0);

	const childRegions = place.kind === 'country' ? getSpillLeaguePlaces() : [];
	const parent =
		place.kind === 'region'
			? (getAllPlaces().find((p) => p.kind === 'country' && p.country === place.country) ?? null)
			: null;

	return {
		place,
		parent,
		year: ranked.year,
		entries: ranked.entries,
		ranked: ranked.entries.length,
		withRecord: ranked.withRecord,
		absent: {
			count: missing.length,
			silentOperators,
			otherReasons: missing.length - namedByOperator
		},
		total: locations.length,
		totalSpills: ranked.entries.reduce((sum, e) => sum + e.spills, 0),
		childRegions,
		generatedAt: getSpillHistoryMeta().generatedAt
	};
}
