import { afterEach, describe, expect, it, vi } from 'vitest';
import { mapPool, pacedMap } from './pool';

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

describe('pacedMap', () => {
	it('processes every item and preserves order', async () => {
		const result = await pacedMap([1, 2, 3, 4], 0, async (n) => n * 10);
		expect(result).toEqual([10, 20, 30, 40]);
	});

	it('handles an empty list', async () => {
		expect(await pacedMap([], 0, async (n) => n)).toEqual([]);
	});

	it('passes the index to the worker', async () => {
		expect(await pacedMap(['a', 'b'], 0, async (_, i) => i)).toEqual([0, 1]);
	});

	it('isolates a rejecting task without failing the batch', async () => {
		const result = await pacedMap([0, 1, 2], 0, async (n) => {
			if (n === 1) throw new Error('boom');
			return n;
		});
		expect(result[0]).toBe(0);
		expect(result[1]).toBeUndefined();
		expect(result[2]).toBe(2);
	});

	describe('pacing', () => {
		afterEach(() => {
			vi.useRealTimers();
		});

		it('starts one task per interval even when a task runs long', async () => {
			vi.useFakeTimers();
			const starts: number[] = [];
			const run = pacedMap([0, 1, 2], 1000, async (n) => {
				starts.push(n);
				await new Promise((r) => setTimeout(r, 9000)); // far longer than the interval
				return n;
			});
			expect(starts).toEqual([0]); // first starts immediately
			await vi.advanceTimersByTimeAsync(1000);
			expect(starts).toEqual([0, 1]); // a long-running task did not delay the next start
			await vi.advanceTimersByTimeAsync(1000);
			expect(starts).toEqual([0, 1, 2]);
			await vi.advanceTimersByTimeAsync(9000);
			expect(await run).toEqual([0, 1, 2]);
		});
	});
});
