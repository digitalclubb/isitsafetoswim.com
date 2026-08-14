// Pure helpers shared by the build script and tested with Vitest.

export function slugify(input) {
	return String(input ?? '')
		.toLowerCase()
		.normalize('NFKD')
		.replace(/[̀-ͯ]/g, '')
		.replace(/&/g, ' and ')
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');
}

export function classifyValue(raw) {
	if (raw === null || raw === undefined) return 'Unknown';
	const lower = String(raw).toLowerCase().trim();
	if (lower.includes('excellent')) return 'Excellent';
	if (lower.includes('sufficient')) return 'Sufficient';
	if (lower.includes('good')) return 'Good';
	if (lower.includes('poor')) return 'Poor';
	if (lower === 'new' || lower.includes('insufficient')) return 'New';
	if (lower.includes('closed') || lower.includes('decommiss')) return 'Closed';
	return 'Unknown';
}

export function extractLabel(value) {
	if (value === null || value === undefined) return undefined;
	if (typeof value === 'string') {
		// Raw URI entries show up alongside human-labelled objects in EA arrays.
		if (/^https?:\/\//i.test(value)) return undefined;
		return value;
	}
	if (Array.isArray(value)) {
		const labels = value.map(extractLabel).filter(Boolean);
		return labels.length ? labels.join(', ') : undefined;
	}
	if (typeof value === 'object') {
		if ('_value' in value) return extractLabel(value._value);
		if ('@value' in value) return extractLabel(value['@value']);
		if ('name' in value) return extractLabel(value.name);
		if ('prefLabel' in value) return extractLabel(value.prefLabel);
		if ('label' in value) return extractLabel(value.label);
	}
	return undefined;
}

export function readSamplingPoint(point) {
	if (!point) return null;
	const lat = Number(point.lat ?? point.latitude);
	const lon = Number(point.long ?? point.longitude ?? point.lng);
	if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
	return { lat, lon };
}

export function lastNonEmptyPathSegment(uri) {
	if (!uri || typeof uri !== 'string') return undefined;
	const tail = uri.split('/').filter(Boolean).pop();
	return tail ? tail : undefined;
}

/**
 * Deduplicates slugs in-place. If two sites collide and live in different
 * countries, the suffix includes the country to disambiguate. If they collide
 * within the same country, a numeric tiebreaker is used. The first occurrence
 * keeps the bare slug.
 */
export function dedupeSlugs(locations) {
	const taken = new Map(); // slug -> country
	const counter = new Map(); // base-slug -> next index
	for (const loc of locations) {
		// The name fallback only holds while every row carries a slug, since a
		// renamed row would slugify to a different URL. display-names.test.mjs
		// asserts the cache never ships a row without one.
		const base = loc.slug || slugify(loc.name);
		if (!taken.has(base)) {
			taken.set(base, loc.country);
			loc.slug = base;
			continue;
		}
		const owningCountry = taken.get(base);
		let candidate;
		if (owningCountry !== loc.country) {
			candidate = `${base}-${slugify(loc.country)}`;
			if (taken.has(candidate)) {
				const n = (counter.get(candidate) ?? 2) + 0;
				candidate = `${candidate}-${n}`;
				counter.set(candidate, n + 1);
			}
		} else {
			const n = counter.get(base) ?? 2;
			candidate = `${base}-${n}`;
			counter.set(base, n + 1);
		}
		taken.set(candidate, loc.country);
		loc.slug = candidate;
	}
	return locations;
}

/**
 * Derive water type from the EA/NRW `type` field, an array of RDF type URIs such
 * as ".../CoastalBathingWater" or ".../RiverBathingWater". Rivers and lakes are
 * inland; coastal and transitional (estuarine) waters use the coastal standard,
 * as does anything unknown (the stricter, fail-safe default).
 */
export function waterTypeFromEaType(type) {
	const tokens = Array.isArray(type) ? type : [type];
	const text = tokens
		.map((t) => String(t ?? ''))
		.join(' ')
		.toLowerCase();
	if (text.includes('river') || text.includes('lake') || text.includes('inland')) return 'inland';
	return 'coastal';
}

/** Read an EA boolean field, which may be a bare boolean, a wrapped {_value} or
 *  a string. Returns undefined when absent so the caller can treat it as unknown. */
export function readEaBoolean(value) {
	if (typeof value === 'boolean') return value;
	if (value && typeof value === 'object' && '_value' in value) return readEaBoolean(value._value);
	if (typeof value === 'string') return value.toLowerCase() === 'true';
	return undefined;
}
