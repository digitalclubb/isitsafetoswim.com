import { describe, expect, it } from 'vitest';
import { assembleColours } from './precompute';

describe('assembleColours', () => {
	it('builds an id to verdict map with the timestamp', () => {
		const blob = assembleColours(
			[
				{ id: 'a', verdict: 'yes' },
				{ id: 'b', verdict: 'no' }
			],
			'2026-06-16T09:00:00.000Z'
		);
		expect(blob).toEqual({
			generatedAt: '2026-06-16T09:00:00.000Z',
			colours: { a: 'yes', b: 'no' }
		});
	});

	it('keeps the last verdict on a duplicate id', () => {
		const blob = assembleColours(
			[
				{ id: 'a', verdict: 'yes' },
				{ id: 'a', verdict: 'no' }
			],
			't'
		);
		expect(blob.colours.a).toBe('no');
	});

	it('produces an empty colour map for no input', () => {
		expect(assembleColours([], 't')).toEqual({ generatedAt: 't', colours: {} });
	});
});
