import type { Classification, CurrentAssessment } from './types';

/**
 * The four genuine rating tiers, in descending order. New, Unknown and Closed
 * are statuses rather than ratings: listing them as things the regulator rates
 * would be wrong, and Unknown is partly a parser catch-all (see ratingLabel
 * below) so it would not be an honest grouping either.
 *
 * Lives here rather than beside the catalogue so it can be imported into a
 * component without dragging locations.json into the client bundle.
 */
export const RATED_TIERS = ['Excellent', 'Good', 'Sufficient', 'Poor'] as const;

export type RatedTier = (typeof RATED_TIERS)[number];

export interface RatingLabel {
	/** Shown on the card. */
	label: string;
	/** Read instead of the label, so the shorthand is unambiguous out of context. */
	announced: string;
}

/**
 * How a site's annual classification reads on a card. Never the verdict's
 * words and never its colours: the classification is a multi-year percentile
 * and says nothing about today, so a site rated Excellent has to be able to sit
 * under a Caution without appearing to contradict it.
 *
 * New and Unknown deliberately share a label. Unknown is the parser's catch-all
 * for a missing or unrecognised value (classifyValue in scripts/lib/parsers.mjs),
 * so it covers long-established waters whose field simply did not parse as well
 * as genuinely undesignated ones. Claiming either is "newly designated" or "not
 * yet rated" asserts something we cannot back, so both say only what is true:
 * we hold no classification for it.
 */
export function ratingLabel(
	classification: Classification,
	assessment?: CurrentAssessment
): RatingLabel {
	switch (classification) {
		case 'Excellent':
		case 'Good':
		case 'Sufficient':
		case 'Poor':
			return {
				label: `Rated ${classification}`,
				announced: `Annual classification: ${classification}`
			};
		case 'Closed':
			return { label: 'Closed', announced: 'This bathing water is closed' };
		default:
			// Northern Ireland has no annual classification to show, but DAERA
			// publishes a weekly reading. Labelling those 33 cards "Unclassified"
			// throws away the only thing the regulator does say about the water.
			// The wording keeps a reading and a rating visibly apart: a single
			// week's sample is not a multi-year percentile and must not read as one.
			if (assessment) {
				if (assessment.level === 'advised-against') {
					return {
						label: 'Advised against',
						announced: 'The regulator advises against bathing here'
					};
				}
				// Past the window the verdict engine uses, the card must stop
				// presenting the reading as current. Sampling stops on 15 September,
				// so without this every Northern Irish card would read "Latest
				// reading Excellent" all winter beside a location page that had
				// already demoted the same site to Caution for being out of date.
				return isReadingCurrent(assessment)
					? {
							label: `Latest reading ${assessment.label}`,
							announced: `Most recent regulator reading: ${assessment.label}`
						}
					: {
							label: `Last reading ${assessment.label}`,
							announced: `Last regulator reading, now out of date: ${assessment.label}`
						};
			}
			return { label: 'Unclassified', announced: 'No annual classification yet' };
	}
}

/**
 * Classifications that warn. They keep the verdict palette at arm's length but
 * must not flatten to the same grey as Excellent, or the card would hide the
 * one thing on it worth noticing.
 */
export function isAdverseRating(
	classification: Classification,
	assessment?: CurrentAssessment
): boolean {
	if (assessment?.level === 'advised-against') return true;
	return classification === 'Poor' || classification === 'Closed';
}

/**
 * How long a regulator reading counts as current, matching SAMPLE_CURRENT_DAYS
 * in the verdict engine so a card and the page it links to never disagree about
 * whether the same reading still stands. Duplicated rather than imported
 * because this module is pulled into the client bundle and the engine is not.
 */
const READING_CURRENT_DAYS = 28;

export function isReadingCurrent(assessment: CurrentAssessment, now: Date = new Date()): boolean {
	if (!assessment.assessedAt) return false;
	const at = Date.parse(assessment.assessedAt);
	if (!Number.isFinite(at)) return false;
	return now.getTime() - at <= READING_CURRENT_DAYS * 24 * 36e5;
}

/** Rated tiers in order, so nothing that must agree with it keeps its own copy. */
export const TIER_RANK: Record<string, number> = {
	Excellent: 4,
	Good: 3,
	Sufficient: 2,
	Poor: 1
};

export interface ClassificationChange {
	direction: 'up' | 'down';
	/** The classification held the season before. */
	from: Classification;
}

/**
 * How a site's classification moved against the season before, or null when it
 * did not move or cannot be compared.
 *
 * Only the four rated tiers rank. New, Unknown and Closed are statuses, so a
 * move into or out of one is not a rise or a fall in water quality and saying
 * so would misread, for instance, a site that closed as one that got worse.
 */
export function classificationChange(
	current: Classification,
	previous: Classification | undefined
): ClassificationChange | null {
	if (!previous) return null;
	const now = TIER_RANK[current];
	const then = TIER_RANK[previous];
	if (!now || !then || now === then) return null;
	return { direction: now > then ? 'up' : 'down', from: previous };
}
