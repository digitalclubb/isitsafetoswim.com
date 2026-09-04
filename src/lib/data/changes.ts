import { getAllLocations } from './locations';
import { classificationChange, TIER_RANK } from './rating';
import type { Classification, Country, Location } from './types';

/**
 * Which bathing waters moved between one annual classification and the next.
 *
 * The classifications are republished every November, and that publication is
 * the single biggest water-quality news moment of the year. It also lands in the
 * middle of the traffic trough, when nobody is asking whether it is safe to swim
 * today. What survives the winter is the question this answers: did my beach get
 * better or worse.
 *
 * Derived from the catalogue, like every other ranking on the site, so the page
 * follows the regulator through each November on its own rather than carrying a
 * hand-written year.
 *
 * England and Wales only. Scotland's feed does not carry a previous
 * classification, and DAERA publishes no classification at all.
 */
export interface ClassificationMove {
	location: Location;
	from: Classification;
	to: Classification;
}

export interface ClassificationChanges {
	/** The season the current classifications were awarded for. */
	year: number;
	/** The season they are compared against. */
	previousYear: number;
	/** Worse than the year before, the steepest falls first. */
	downgrades: ClassificationMove[];
	/** Better than the year before. */
	upgrades: ClassificationMove[];
	/** Sites that could be compared at all, which is the denominator. */
	compared: number;
	countries: Country[];
}

/**
 * How far a site moved, so a two-tier fall outranks a one-tier fall. Both ends
 * are guaranteed rated tiers, because classificationChange refuses to rank a
 * status.
 */
function distance(move: ClassificationMove): number {
	return Math.abs(TIER_RANK[move.to] - TIER_RANK[move.from]);
}

/**
 * Biggest move first, then by destination: worst landing place first among
 * falls, best first among rises. Sorting both the same way would put a
 * Sufficient to Good rise above a Good to Excellent one.
 */
function bySeverity(direction: 'down' | 'up') {
	return (a: ClassificationMove, b: ClassificationMove): number => {
		const byDestination =
			direction === 'down' ? TIER_RANK[a.to] - TIER_RANK[b.to] : TIER_RANK[b.to] - TIER_RANK[a.to];
		return (
			distance(b) - distance(a) ||
			byDestination ||
			a.location.name.localeCompare(b.location.name, 'en-GB')
		);
	};
}

let cached: ClassificationChanges | null = null;

export function getClassificationChanges(): ClassificationChanges | null {
	if (cached) return cached;

	const comparable = getAllLocations().filter(
		(l) => l.classificationYear && l.previousClassification
	);
	if (comparable.length === 0) return null;

	// Follow the regulator rather than assume a year. Sites are compared only
	// against the newest season present, so a site whose record stops earlier is
	// left out rather than compared across a gap.
	const year = Math.max(...comparable.map((l) => l.classificationYear ?? 0));
	const rows = comparable.filter((l) => l.classificationYear === year);

	const downgrades: ClassificationMove[] = [];
	const upgrades: ClassificationMove[] = [];
	for (const location of rows) {
		const change = classificationChange(location.classification, location.previousClassification);
		if (!change) continue;
		const move = { location, from: change.from, to: location.classification };
		if (change.direction === 'down') downgrades.push(move);
		else upgrades.push(move);
	}

	downgrades.sort(bySeverity('down'));
	upgrades.sort(bySeverity('up'));

	cached = {
		year,
		previousYear: year - 1,
		downgrades,
		upgrades,
		compared: rows.length,
		countries: [...new Set(rows.map((l) => l.country))].sort()
	};
	return cached;
}
