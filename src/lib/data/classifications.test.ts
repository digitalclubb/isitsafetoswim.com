import { describe, expect, it } from 'vitest';
import { getRatingBySlug, getTierSummaries, parseTierSlug, tierSlug } from './classifications';
import { getAllLocations } from './locations';
import { RATED_TIERS } from './rating';

function ratingFor(slug: string) {
	const page = getRatingBySlug(slug);
	if (!page) throw new Error(`no rating page for ${slug}`);
	return page;
}

describe('tier slugs', () => {
	it('round-trips every rated tier', () => {
		for (const tier of RATED_TIERS) {
			expect(parseTierSlug(tierSlug(tier))).toBe(tier);
		}
	});

	it('rejects statuses that are not ratings', () => {
		for (const slug of ['new', 'unknown', 'closed', 'excellent-beaches', '']) {
			expect(parseTierSlug(slug)).toBeNull();
		}
	});
});

describe('getRatingBySlug', () => {
	it('returns null for an unknown slug', () => {
		expect(getRatingBySlug('brilliant')).toBeNull();
	});

	it('lists every location holding that classification and nothing else', () => {
		for (const tier of RATED_TIERS) {
			const page = ratingFor(tierSlug(tier));
			const listed = page.byCountry.flatMap((g) => g.locations);
			expect(listed).toHaveLength(page.total);
			expect(listed.every((l) => l.classification === tier)).toBe(true);
		}
	});

	it('accounts for every rated location across the four tiers', () => {
		const listed = RATED_TIERS.reduce((sum, tier) => sum + ratingFor(tierSlug(tier)).total, 0);
		const rated = getAllLocations().filter((l) =>
			(RATED_TIERS as readonly string[]).includes(l.classification)
		).length;
		expect(listed).toBe(rated);
	});

	it('groups only countries that have a location at that tier', () => {
		expect(ratingFor('excellent').byCountry.every((g) => g.locations.length > 0)).toBe(true);
	});

	it('sorts within a country by region then name', () => {
		for (const group of ratingFor('excellent').byCountry) {
			const keys = group.locations.map((l) => `${l.region ?? ''}|${l.name}`);
			expect(keys).toEqual([...keys].sort((a, b) => a.localeCompare(b, 'en-GB')));
		}
	});

	// The country order drives the reader-facing breakdown sentence, so it is a
	// copy decision rather than an implementation detail.
	it('orders countries England, Wales, Scotland then Northern Ireland', () => {
		const order = ['England', 'Wales', 'Scotland', 'Northern Ireland'];
		for (const tier of RATED_TIERS) {
			const countries = ratingFor(tierSlug(tier)).byCountry.map((g) => g.country);
			expect(countries).toEqual(order.filter((c) => countries.includes(c as never)));
		}
	});

	it('carries sibling counts matching the summaries', () => {
		expect(ratingFor('poor').siblings).toEqual(getTierSummaries());
	});
});
