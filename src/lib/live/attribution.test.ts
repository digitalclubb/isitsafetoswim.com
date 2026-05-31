import { describe, expect, it } from 'vitest';
import { attributionFor } from './attribution';

describe('attributionFor', () => {
	it('credits the regulator and nothing else without overflow data', () => {
		const out = attributionFor('England');
		expect(out.some((l) => l.includes('Environment Agency'))).toBe(true);
		expect(out.some((l) => l.includes('storm overflow'))).toBe(false);
	});

	it('credits the ArcGIS company feeds under OGL', () => {
		const out = attributionFor('England', 'ogl');
		expect(out.some((l) => l.includes('OGL v3'))).toBe(true);
		expect(out.some((l) => l.includes('Thames Water'))).toBe(false);
	});

	it('credits Thames Water under its own terms, not OGL', () => {
		const out = attributionFor('England', 'thames');
		expect(out.some((l) => l.includes('Thames Water'))).toBe(true);
		expect(out.some((l) => l.includes('OGL v3'))).toBe(false);
	});
});
