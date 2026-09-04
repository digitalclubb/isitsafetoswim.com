import { describe, expect, it } from 'vitest';
import { getClassificationChanges } from './changes';

/**
 * Runs against the committed catalogue. The claims worth pinning are that no
 * site is compared across a gap, that a status is never reported as a fall in
 * water quality, and that the page follows the regulator's year rather than a
 * hard-coded one.
 */
describe('getClassificationChanges', () => {
	const changes = getClassificationChanges();

	it('compares the newest season against the one before', () => {
		expect(changes).not.toBeNull();
		expect(changes?.previousYear).toBe((changes?.year ?? 0) - 1);
	});

	it('finds movement in both directions', () => {
		expect(changes?.downgrades.length).toBeGreaterThan(0);
		expect(changes?.upgrades.length).toBeGreaterThan(0);
	});

	it('never puts the same site in both lists', () => {
		const down = new Set(changes?.downgrades.map((m) => m.location.slug));
		for (const up of changes?.upgrades ?? []) {
			expect(down.has(up.location.slug)).toBe(false);
		}
	});

	it('only ever reports a real move', () => {
		for (const move of [...(changes?.downgrades ?? []), ...(changes?.upgrades ?? [])]) {
			expect(move.from).not.toBe(move.to);
		}
	});

	it('never treats a status as a change in water quality', () => {
		// Closed, New and Unknown are statuses. A site that closed has not got
		// worse, and a parser catch-all is not an improvement.
		const statuses = new Set(['Closed', 'New', 'Unknown']);
		for (const move of [...(changes?.downgrades ?? []), ...(changes?.upgrades ?? [])]) {
			expect(statuses.has(move.from)).toBe(false);
			expect(statuses.has(move.to)).toBe(false);
		}
	});

	it('ranks the steepest falls first', () => {
		const rank: Record<string, number> = { Excellent: 4, Good: 3, Sufficient: 2, Poor: 1 };
		const drops = (changes?.downgrades ?? []).map((m) => rank[m.from] - rank[m.to]);
		for (let i = 1; i < drops.length; i += 1) {
			expect(drops[i]).toBeLessThanOrEqual(drops[i - 1]);
		}
	});

	it('compares only countries whose regulator publishes a previous classification', () => {
		// Scotland's feed carries no previous year and DAERA publishes no
		// classification at all, so neither may appear as an unchanged baseline.
		expect(changes?.countries).not.toContain('Scotland');
		expect(changes?.countries).not.toContain('Northern Ireland');
	});

	it('counts a denominator at least as large as the moves', () => {
		const moved = (changes?.downgrades.length ?? 0) + (changes?.upgrades.length ?? 0);
		expect(changes?.compared).toBeGreaterThanOrEqual(moved);
	});
});

describe('ordering within each direction', () => {
	const changes = getClassificationChanges();
	const rank: Record<string, number> = { Excellent: 4, Good: 3, Sufficient: 2, Poor: 1 };

	it('puts the worst landing place first among equal falls', () => {
		const rows = changes?.downgrades ?? [];
		for (let i = 1; i < rows.length; i += 1) {
			const sameSize =
				rank[rows[i].from] - rank[rows[i].to] === rank[rows[i - 1].from] - rank[rows[i - 1].to];
			if (sameSize) expect(rank[rows[i].to]).toBeGreaterThanOrEqual(rank[rows[i - 1].to]);
		}
	});

	it('puts the best landing place first among equal rises', () => {
		// Sorting both directions the same way would rank a Sufficient to Good
		// jump above a Good to Excellent one.
		const rows = changes?.upgrades ?? [];
		for (let i = 1; i < rows.length; i += 1) {
			const sameSize =
				rank[rows[i].to] - rank[rows[i].from] === rank[rows[i - 1].to] - rank[rows[i - 1].from];
			if (sameSize) expect(rank[rows[i].to]).toBeLessThanOrEqual(rank[rows[i - 1].to]);
		}
	});
});
