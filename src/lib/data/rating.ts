import type { Classification } from './types';

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
export function ratingLabel(classification: Classification): RatingLabel {
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
			return { label: 'Unclassified', announced: 'No annual classification yet' };
	}
}

/**
 * Classifications that warn. They keep the verdict palette at arm's length but
 * must not flatten to the same grey as Excellent, or the card would hide the
 * one thing on it worth noticing.
 */
export function isAdverseRating(classification: Classification): boolean {
	return classification === 'Poor' || classification === 'Closed';
}
