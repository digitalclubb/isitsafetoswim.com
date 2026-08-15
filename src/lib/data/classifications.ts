import { getAllLocations, getIndexMeta } from './locations';
import { RATED_TIERS, type RatedTier } from './rating';
import type { Country, Location } from './types';

const COUNTRY_ORDER: Country[] = ['England', 'Wales', 'Scotland', 'Northern Ireland'];

/**
 * What each tier means, in the reader's words rather than the regulations'.
 * Classification is a percentile over up to four bathing seasons, which is the
 * one thing that most needs saying: it describes the water's record, not today.
 *
 * "Up to" is load-bearing. Four seasons is the default, not the rule: a site
 * designated more recently is classified on fewer, so stating four flatly would
 * be wrong for every recent designation.
 *
 * The Poor wording names no actor on purpose, because the duty sits in a
 * different place in each country: the local authority that controls the
 * bathing water in England and Wales (Bathing Water Regulations 2013 reg
 * 13(1)(b)), the operator in Northern Ireland (NI 2008 reg 14(b)(ii)) and SEPA
 * itself in Scotland (Scotland 2008 reg 11). Crediting "the regulator" would be
 * wrong on three of the four countries this page lists. The verdict engine
 * hedges the same way.
 */
const TIER_MEANING: Record<RatedTier, string> = {
	Excellent:
		'The highest of the four standards, awarded on bacteria readings taken across up to the last four bathing seasons.',
	Good:
		'The second of the four standards and a stricter test than the minimum, awarded on readings across up to the last four bathing seasons.',
	Sufficient:
		'The minimum pass. These waters met the standard across up to the last four bathing seasons, on a more forgiving test than Good.',
	Poor:
		'Below the minimum standard. Advice against bathing must be displayed at these sites for the following bathing season.'
};

export interface RatedCountryGroup {
	country: Country;
	locations: Location[];
}

export interface TierSummary {
	tier: RatedTier;
	slug: string;
	count: number;
}

export interface RatingPage {
	tier: RatedTier;
	slug: string;
	meaning: string;
	total: number;
	byCountry: RatedCountryGroup[];
	/** Every tier with its count, so each page can link to the other three. */
	siblings: TierSummary[];
	generatedAt: string;
}

export function tierSlug(tier: RatedTier): string {
	return tier.toLowerCase();
}

export function parseTierSlug(slug: string): RatedTier | null {
	return RATED_TIERS.find((tier) => tierSlug(tier) === slug) ?? null;
}

function countFor(tier: RatedTier): number {
	return getAllLocations().filter((l) => l.classification === tier).length;
}

export function getTierSummaries(): TierSummary[] {
	return RATED_TIERS.map((tier) => ({ tier, slug: tierSlug(tier), count: countFor(tier) }));
}

export function getRatingBySlug(slug: string): RatingPage | null {
	const tier = parseTierSlug(slug);
	if (!tier) return null;

	const matching = getAllLocations().filter((l) => l.classification === tier);
	const byCountry = COUNTRY_ORDER.map((country) => ({
		country,
		locations: matching
			.filter((l) => l.country === country)
			.sort(
				(a, b) =>
					(a.region ?? '').localeCompare(b.region ?? '', 'en-GB') ||
					a.name.localeCompare(b.name, 'en-GB')
			)
	})).filter((group) => group.locations.length > 0);

	return {
		tier,
		slug: tierSlug(tier),
		meaning: TIER_MEANING[tier],
		total: matching.length,
		byCountry,
		siblings: getTierSummaries(),
		generatedAt: getIndexMeta().generatedAt
	};
}
