import { describe, expect, it } from 'vitest';
import { mapPool } from './pool';

describe('mapPool', () => {
	it('processes every item and preserves input order', async () => {
		const items = [1, 2, 3, 4, 5];
		const result = await mapPool(items, 2, async (n) => n * 2);
		expect(result).toEqual([2, 4, 6, 8, 10]);
	});

	it('never exceeds the concurrency limit', async () => {
		let active = 0;
		let peak = 0;
		const items = Array.from({ length: 20 }, (_, i) => i);
		await mapPool(items, 3, async () => {
			active += 1;
			peak = Math.max(peak, active);
			await Promise.resolve();
			active -= 1;
		});
		expect(peak).toBeLessThanOrEqual(3);
	});

	it('handles an empty list', async () => {
		expect(await mapPool([], 4, async (n) => n)).toEqual([]);
	});

	it('passes the index to the worker', async () => {
		const result = await mapPool(['a', 'b', 'c'], 5, async (_, i) => i);
		expect(result).toEqual([0, 1, 2]);
	});
});
