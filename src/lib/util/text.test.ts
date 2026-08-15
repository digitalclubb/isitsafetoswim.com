import { describe, expect, it } from 'vitest';
import { joinList } from './text';

describe('joinList', () => {
	it('returns an empty string for no items', () => {
		expect(joinList([])).toBe('');
	});

	it('returns a single item unchanged', () => {
		expect(joinList(['32 in England'])).toBe('32 in England');
	});

	it('joins a pair with "and" and no comma', () => {
		expect(joinList(['a', 'b'])).toBe('a and b');
	});

	it('takes no Oxford comma on three or more', () => {
		expect(joinList(['a', 'b', 'c'])).toBe('a, b and c');
		expect(joinList(['a', 'b', 'c', 'd'])).toBe('a, b, c and d');
	});

	it('never puts a comma before "and"', () => {
		for (const n of [2, 3, 4, 5, 9]) {
			const items = Array.from({ length: n }, (_, i) => `item ${i}`);
			expect(joinList(items)).not.toMatch(/, and /);
		}
	});
});
