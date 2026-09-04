import { getAllLocations, getIndexMeta } from './locations';
import { RATED_TIERS } from './rating';
import type { Classification, Country, Location } from './types';

const RATED_CLASSIFICATIONS = new Set<Classification>(RATED_TIERS);

/**
 * Regional and country hub pages ("Cleanest beaches in Cornwall") are
 * derived entirely from the location catalogue, so they can never carry stale
 * hand-written rankings. A region needs at least this many bathing waters to
 * earn its own page; smaller regions roll up into their country page only.
 */
const REGION_MIN = 5;

/**
 * Where no classification is published, the regulator's own weekly reading is
 * the only order there is. Kept separate from CLASS_RANK because the two are
 * not comparable: one is a multi-year percentile, the other is last week.
 */
const ASSESSMENT_RANK: Record<string, number> = {
	good: 0,
	satisfactory: 1,
	'advised-against': 2
};

const CLASS_RANK: Record<Classification, number> = {
	Excellent: 0,
	Good: 1,
	Sufficient: 2,
	Poor: 3,
	Closed: 4,
	New: 5,
	Unknown: 6
};

export type PlaceKind = 'country' | 'region';

export interface Place {
	slug: string;
	name: string;
	kind: PlaceKind;
	country: Country;
	count: number;
}

export interface PlacePage {
	place: Place;
	parent: Place | null;
	/**
	 * Whether the regulator publishes annual classifications here at all. False
	 * for Northern Ireland, where DAERA publishes only a weekly reading, so the
	 * page must not describe its order as a classification ranking or read an
	 * empty `cleanest` as "nothing here is rated Excellent or Good".
	 */
	classified: boolean;
	ranked: Location[];
	cleanest: Location[];
	countsByClass: Array<{ classification: Classification; count: number }>;
	childRegions: Place[];
	generatedAt: string;
}

function slugify(input: string): string {
	return input
		.normalize('NFKD')
		.replace(/[̀-ͯ]/g, '')
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');
}

const places: Place[] = [];
const bySlug = new Map<string, Place>();

function register(place: Place): void {
	let slug = place.slug;
	if (bySlug.has(slug)) slug = `${slug}-${slugify(place.country)}`;
	const finalised = { ...place, slug };
	places.push(finalised);
	bySlug.set(slug, finalised);
}

{
	const locations = getAllLocations();
	const countries = getIndexMeta().byCountry;

	// Countries first so they reserve the cleaner slug on any collision.
	for (const country of Object.keys(countries) as Country[]) {
		const count = countries[country];
		if (!count) continue;
		register({ slug: slugify(country), name: country, kind: 'country', country, count });
	}

	const regionCounts = new Map<string, { name: string; country: Country; count: number }>();
	for (const loc of locations) {
		if (!loc.region) continue;
		const key = `${loc.country}|${loc.region}`;
		const entry = regionCounts.get(key) ?? { name: loc.region, country: loc.country, count: 0 };
		entry.count += 1;
		regionCounts.set(key, entry);
	}

	for (const { name, country, count } of regionCounts.values()) {
		if (count < REGION_MIN) continue;
		register({ slug: slugify(name), name, kind: 'region', country, count });
	}
}

export function getAllPlaces(): readonly Place[] {
	return places;
}

/**
 * The most specific area hub a bathing water belongs to: its region page when
 * the region is large enough to have one, otherwise its country page (which
 * always exists). Used to link a location back up to its area.
 */
export function getHubForLocation(country: Country, region?: string): Place {
	if (region) {
		const found = places.find(
			(p) => p.kind === 'region' && p.country === country && p.name === region
		);
		if (found) return found;
	}
	return places.find((p) => p.kind === 'country' && p.country === country) as Place;
}

function locationsForPlace(place: Place): Location[] {
	const all = getAllLocations();
	if (place.kind === 'country') return all.filter((l) => l.country === place.country);
	return all.filter((l) => l.country === place.country && l.region === place.name);
}

export function getPlaceBySlug(slug: string): PlacePage | null {
	const place = bySlug.get(slug);
	if (!place) return null;

	const all = locationsForPlace(place);
	const classified = all.some((l) => RATED_CLASSIFICATIONS.has(l.classification));

	// An unclassified place is ordered by the regulator's reading instead, so
	// Northern Ireland gets a real order rather than 33 rows of alphabet.
	const ranked = classified
		? all
				.slice()
				.sort(
					(a, b) =>
						CLASS_RANK[a.classification] - CLASS_RANK[b.classification] ||
						a.name.localeCompare(b.name, 'en-GB')
				)
		: all
				.slice()
				.sort(
					(a, b) =>
						(ASSESSMENT_RANK[a.currentAssessment?.level ?? ''] ?? 3) -
							(ASSESSMENT_RANK[b.currentAssessment?.level ?? ''] ?? 3) ||
						a.name.localeCompare(b.name, 'en-GB')
				);

	const cleanest = classified
		? ranked
				.filter((l) => l.classification === 'Excellent' || l.classification === 'Good')
				.slice(0, 6)
		: ranked.filter((l) => l.currentAssessment?.level === 'good').slice(0, 6);

	const tally = new Map<Classification, number>();
	for (const l of ranked) tally.set(l.classification, (tally.get(l.classification) ?? 0) + 1);
	const countsByClass = [...tally.entries()]
		.sort((a, b) => CLASS_RANK[a[0]] - CLASS_RANK[b[0]])
		.map(([classification, count]) => ({ classification, count }));

	const childRegions =
		place.kind === 'country'
			? places
					.filter((p) => p.kind === 'region' && p.country === place.country)
					.sort((a, b) => a.name.localeCompare(b.name, 'en-GB'))
			: [];

	const parent =
		place.kind === 'region'
			? (places.find((p) => p.kind === 'country' && p.country === place.country) ?? null)
			: null;

	return {
		place,
		parent,
		classified,
		ranked,
		cleanest,
		countsByClass,
		childRegions,
		generatedAt: getIndexMeta().generatedAt
	};
}
