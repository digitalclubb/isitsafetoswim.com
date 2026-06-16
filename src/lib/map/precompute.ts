import type { Verdict } from '$lib/data/types';
import type { MapColours } from './types';

/**
 * Fold per-beach verdicts into the compact blob the map reads. Kept pure and
 * separate from the input gathering so the assembly is unit-testable without
 * any network. The gathering orchestration (batch fetch plus the verdict
 * engine) builds the verdict list this consumes.
 */
export function assembleColours(
	verdicts: ReadonlyArray<{ id: string; verdict: Verdict }>,
	generatedAt: string
): MapColours {
	const colours: Record<string, Verdict> = {};
	for (const { id, verdict } of verdicts) colours[id] = verdict;
	return { generatedAt, colours };
}
