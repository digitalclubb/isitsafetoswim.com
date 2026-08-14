/**
 * Regulators name a bathing water after its sampling point, which is often not
 * what anyone searches for. "Minehead Terminus" is the beach at Minehead and
 * "Whitmore Bay Barry Island" is missing the comma the Environment Agency uses
 * in its own compound names elsewhere in the catalogue.
 *
 * Overriding the displayed name costs nothing and lifts the title, the heading
 * and every card that lists the site. Search Console shows these pages taking
 * between 0.5% and 3.4% click-through from the first page of results, against
 * about 5% for sites whose regulator name already matches the vernacular.
 *
 * Keyed by slug, which is derived from the regulator name and stays fixed, so
 * renaming here can never move a URL. Only sites that are unambiguously their
 * town's main beach are renamed, and only where the new name collides with
 * nothing else in the catalogue.
 */
export const DISPLAY_NAMES = Object.freeze(
	/** @type {Record<string, string>} */ ({
		// Compound names missing the separating comma.
		'whitmore-bay-barry-island': 'Whitmore Bay, Barry Island',
		'jackson-s-bay-barry-island': "Jackson's Bay, Barry Island",
		'cold-knap-barry': 'Cold Knap, Barry',
		'sandy-bay-porthcawl': 'Sandy Bay, Porthcawl',
		'rest-bay-porthcawl': 'Rest Bay, Porthcawl',
		'southend-chalkwell': 'Chalkwell Beach, Southend',
		'southend-thorpe-bay': 'Thorpe Bay, Southend',
		'southend-westcliff-bay': 'Westcliff Bay, Southend',
		'bournemouth-alum-chine': 'Alum Chine, Bournemouth',
		'bournemouth-southbourne': 'Southbourne, Bournemouth',
		'llandudno-west-shore': 'West Shore, Llandudno',
		'portrush-curran-east-strand': 'East Strand, Portrush',
		'portrush-mill-west-strand': 'West Strand, Portrush',

		// Backtick where an apostrophe belongs, straight from the regulator feed.
		'bournemouth-fisherman-s-walk': "Fisherman's Walk, Bournemouth",
		'christchurch-friar-s-cliff': "Friar's Cliff, Christchurch",
		'mother-ivey-s-bay': "Mother Ivey's Bay",
		'norman-s-bay': "Norman's Bay",
		'st-margaret-s-bay': "St Margaret's Bay",

		// Sampling-point jargon for what people simply call the town beach.
		// Claiming the plain "X Beach" name is only safe where the town has one
		// bathing water, or where its others are classified the same. Where a
		// neighbouring beach is rated differently, the regulator's qualifier is
		// load-bearing: someone who lands on the wrong one gets the wrong answer.
		// That rules out Brighton, Weymouth, Herne Bay and Bognor Regis, whose
		// second beach is rated better or worse than the one people search for.
		'minehead-terminus': 'Minehead Beach',
		'sidmouth-town': 'Sidmouth Beach'
	})
);

/**
 * Replaces the regulator name with the searched-for one, in place, keeping the
 * original as `officialName` so site search still answers to what is printed
 * on the beach board. Warns about any override that matched nothing, which is
 * how a regulator quietly renaming or dropping a site surfaces rather than
 * rotting unnoticed.
 */
export function applyDisplayNames(locations, warn = console.warn) {
	const unused = new Set(Object.keys(DISPLAY_NAMES));

	for (const location of locations) {
		// hasOwn, so a bathing water named "Constructor" could never pick up a
		// function from the object prototype.
		if (!Object.hasOwn(DISPLAY_NAMES, location.slug)) continue;
		const replacement = DISPLAY_NAMES[location.slug];
		unused.delete(location.slug);
		if (location.name === replacement) continue;
		location.officialName = location.name;
		location.name = replacement;
	}

	if (unused.size > 0) {
		warn(
			`[display-names] no bathing water matched: ${[...unused].sort().join(', ')}. ` +
				'Remove the entry or correct the slug.'
		);
	}

	return locations;
}
