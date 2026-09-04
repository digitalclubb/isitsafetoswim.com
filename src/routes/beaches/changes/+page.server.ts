import { error } from '@sveltejs/kit';
import type { ClassificationMove } from '$lib/data/changes';
import { getClassificationChanges } from '$lib/data/changes';
import { getIndexMeta } from '$lib/data/locations';
import type { PageServerLoad } from './$types';

export const prerender = true;

function toRow(move: ClassificationMove) {
	return {
		slug: move.location.slug,
		name: move.location.name,
		region: move.location.region,
		country: move.location.country,
		from: move.from,
		to: move.to
	};
}

/**
 * Failing the build is the right outcome here, not a soft empty state. This
 * returns null only when no location in the catalogue holds both a
 * classification year and the season before it, which cannot happen while the
 * committed cache carries them. If it ever does, the alternative is publishing
 * and indexing a page with nothing on it, and a loud build failure is the same
 * choice the location index makes when a regulator fails and the cache cannot
 * cover it.
 */
export const load: PageServerLoad = () => {
	const changes = getClassificationChanges();
	if (!changes) throw error(500, 'No classification history available');

	return {
		year: changes.year,
		previousYear: changes.previousYear,
		downgrades: changes.downgrades.map(toRow),
		upgrades: changes.upgrades.map(toRow),
		compared: changes.compared,
		countries: changes.countries,
		generatedAt: getIndexMeta().generatedAt
	};
};
