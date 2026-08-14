import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { applyDisplayNames, DISPLAY_NAMES } from './display-names.mjs';
import { dedupeSlugs } from './parsers.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const noop = () => {};

describe('applyDisplayNames', () => {
	it('replaces the regulator name with the searched-for one', () => {
		const locations = [
			{ slug: 'minehead-terminus', name: 'Minehead Terminus' },
			{ slug: 'whitmore-bay-barry-island', name: 'Whitmore Bay Barry Island' }
		];

		applyDisplayNames(locations, noop);

		expect(locations[0].name).toBe('Minehead Beach');
		expect(locations[1].name).toBe('Whitmore Bay, Barry Island');
	});

	// The one invariant the whole change rests on: renaming must never move a URL.
	it('never touches the slug', () => {
		const locations = [{ slug: 'minehead-terminus', name: 'Minehead Terminus' }];

		applyDisplayNames(locations, noop);

		expect(locations[0].slug).toBe('minehead-terminus');
	});

	it('keeps the regulator name so site search still answers to it', () => {
		const locations = [{ slug: 'minehead-terminus', name: 'Minehead Terminus' }];

		applyDisplayNames(locations, noop);

		expect(locations[0].officialName).toBe('Minehead Terminus');
	});

	it('leaves a bathing water with no override untouched', () => {
		const locations = [{ slug: 'brean', name: 'Brean' }];

		applyDisplayNames(locations, noop);

		expect(locations[0].name).toBe('Brean');
	});

	it('warns about an override that matched no bathing water', () => {
		const warnings = [];

		applyDisplayNames([{ slug: 'brean', name: 'Brean' }], (message) => warnings.push(message));

		expect(warnings).toHaveLength(1);
		expect(warnings[0]).toContain('minehead-terminus');
	});

	it('stays silent when every override finds its site', () => {
		const warnings = [];
		const locations = Object.keys(DISPLAY_NAMES).map((slug) => ({ slug, name: 'original' }));

		applyDisplayNames(locations, (message) => warnings.push(message));

		expect(warnings).toHaveLength(0);
	});

	// The cache stores renamed records, so a build that falls back to it feeds
	// already-renamed rows back through the same pipeline. That round trip, not
	// double application on its own, is where a URL could move.
	it('leaves slugs untouched when cached renamed records are rebuilt', () => {
		const fresh = [
			{ slug: 'minehead-terminus', name: 'Minehead Terminus', country: 'England' },
			{ slug: 'southend-chalkwell', name: 'Southend Chalkwell', country: 'England' }
		];
		dedupeSlugs(fresh);
		applyDisplayNames(fresh, noop);

		const cached = fresh.map((l) => ({ ...l }));
		dedupeSlugs(cached);
		applyDisplayNames(cached, noop);

		expect(cached.map((l) => l.slug)).toEqual(['minehead-terminus', 'southend-chalkwell']);
		expect(cached.map((l) => l.name)).toEqual(['Minehead Beach', 'Chalkwell Beach, Southend']);
		expect(cached.map((l) => l.officialName)).toEqual(['Minehead Terminus', 'Southend Chalkwell']);
	});
});

describe('DISPLAY_NAMES against the shipped catalogue', () => {
	const catalogue = JSON.parse(
		readFileSync(resolve(here, '..', '..', 'src', 'data', 'locations.json'), 'utf8')
	).locations;

	it('renames only bathing waters that exist', () => {
		const slugs = new Set(catalogue.map((l) => l.slug));

		for (const slug of Object.keys(DISPLAY_NAMES)) {
			expect(slugs, `no bathing water has slug "${slug}"`).toContain(slug);
		}
	});

	// Renaming a site onto a name another site already answers to would send a
	// reader to the wrong beach, which on this site means the wrong answer.
	//
	// Only names this map introduces are checked. The regulators ship genuine
	// duplicates of their own, such as the Whitesands in Pembrokeshire and the
	// one in Dumfries and Galloway, which are not this map's to resolve.
	it('never renames a site onto a name another site already uses', () => {
		for (const [slug, name] of Object.entries(DISPLAY_NAMES)) {
			const clashes = catalogue
				.filter((l) => l.slug !== slug)
				.filter((l) => (DISPLAY_NAMES[l.slug] ?? l.name) === name)
				.map((l) => l.slug);

			expect(clashes, `"${name}" is already used by ${clashes.join(', ')}`).toEqual([]);
		}
	});

	// dedupeSlugs falls back to slugifying the name when a row has no slug, and
	// a renamed row would slugify to a different URL. The cache is the only
	// source that could ever supply such a row, so it is checked directly.
	it('ships no cached record that could have its slug re-derived', () => {
		const cached = JSON.parse(
			readFileSync(resolve(here, '..', '.locations.cache.json'), 'utf8')
		).locations;

		expect(cached.filter((l) => !l.slug)).toEqual([]);
	});

	// Dropping the regulator's qualifier is only safe when there is nothing to
	// be confused with. Where a neighbouring beach in the same town is rated
	// differently, landing on the wrong page gives the wrong answer.
	it('keeps the qualifier where a town has beaches of differing classification', () => {
		for (const [slug, name] of Object.entries(DISPLAY_NAMES)) {
			const site = catalogue.find((l) => l.slug === slug);
			const town = name.replace(/ Beach$/, '');
			if (town === name) continue;

			const neighbours = catalogue.filter(
				(l) => l.slug !== slug && l.name.startsWith(town) && l.classification !== site.classification
			);

			expect(
				neighbours.map((l) => l.slug),
				`"${name}" drops a qualifier that distinguishes it from a differently rated beach`
			).toEqual([]);
		}
	});
});
