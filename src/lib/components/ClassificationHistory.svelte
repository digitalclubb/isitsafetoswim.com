<script lang="ts">
	import type { Classification } from '$lib/data/types';
	import { joinList } from '$lib/util/text';

	let {
		history,
		locationName
	}: {
		history: Array<{ year: number; classification: Classification }>;
		locationName: string;
	} = $props();

	// Four tiers, so four bar heights. A year the regulator reports as Closed is
	// a status, not a rating, so it is drawn as an absence like an unclassified
	// year rather than as a short bar, which would read as a very poor score.
	const HEIGHT: Record<string, number> = {
		Excellent: 100,
		Good: 75,
		Sufficient: 50,
		Poor: 25
	};

	function isRated(classification: Classification): boolean {
		return classification in HEIGHT;
	}

	// The summary reads off the rated years only, so it never says a site was
	// "rated Closed".
	let rated = $derived(history.filter((h) => isRated(h.classification)));
	let first = $derived(rated[0] ?? history[0]);
	let last = $derived(rated[rated.length - 1] ?? history[history.length - 1]);

	// The years the classification actually holds, so a gap in the middle reads
	// as a gap rather than the series quietly closing over it. 2020 has no
	// classification anywhere: the pandemic cut the bathing season short.
	let span = $derived(
		(() => {
			const from = history[0].year;
			const to = history[history.length - 1].year;
			return Array.from({ length: to - from + 1 }, (_, i) => {
				const year = from + i;
				const entry = history.find((h) => h.year === year) ?? null;
				return { year, entry: entry && isRated(entry.classification) ? entry : null };
			});
		})()
	);

	// Closed is drawn as an absence, so without naming the years it is
	// indistinguishable from the 2020 pandemic gap the note explains. On a site
	// that is closed right now, that is an absence reading as an all-clear.
	let closedYears = $derived(
		history.filter((h) => h.classification === 'Closed').map((h) => h.year)
	);

	let summary = $derived(
		(first.classification === last.classification
			? `Rated ${last.classification} in both ${first.year} and ${last.year}.`
			: `Rated ${first.classification} in ${first.year} and ${last.classification} in ${last.year}.`) +
			(closedYears.length > 0
				? ` Closed to bathing in ${joinList(closedYears.map(String))}.`
				: '')
	);
</script>

<figure class="history">
	<figcaption class="sr-only">
		Annual classification for {locationName}, {span[0].year} to {span[span.length - 1].year}.
		{summary}
		{#each span as slot (slot.year)}
			{slot.year}: {slot.entry ? slot.entry.classification : 'no classification'}.
		{/each}
	</figcaption>
	<ol class="bars">
		{#each span as slot (slot.year)}
			<li class:missing={!slot.entry}>
				{#if slot.entry}
					<span
						class="bar"
						data-tier={slot.entry.classification}
						style={`height:${HEIGHT[slot.entry.classification]}%`}
						title={`${slot.year}: ${slot.entry.classification}`}
					></span>
				{:else}
					<span
						class="bar none"
						title={`${slot.year}: ${closedYears.includes(slot.year) ? 'closed to bathing' : 'no classification'}`}
					></span>
				{/if}
				<span class="year">{String(slot.year).slice(2)}</span>
			</li>
		{/each}
	</ol>
	<p class="summary">{summary}</p>
</figure>

<style>
	.history {
		margin: 0;
	}

	.bars {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		align-items: flex-end;
		gap: var(--space-2);
		height: 96px;
	}

	.bars li {
		flex: 1;
		display: flex;
		flex-direction: column;
		justify-content: flex-end;
		align-items: stretch;
		height: 100%;
		min-width: 0;
	}

	.bar {
		display: block;
		border-radius: 2px 2px 0 0;
		background: var(--rule-strong);
		min-height: 4px;
	}

	.bar[data-tier='Excellent'] {
		background: var(--yes);
	}

	.bar[data-tier='Good'] {
		background: color-mix(in srgb, var(--yes) 65%, var(--rule-strong));
	}

	.bar[data-tier='Sufficient'] {
		background: var(--caution);
	}

	.bar[data-tier='Poor'] {
		background: var(--no);
	}

	/* A year with no classification is drawn as an absence, not a low score. */
	.bar.none {
		height: 100%;
		background: repeating-linear-gradient(
			-45deg,
			var(--rule) 0 3px,
			transparent 3px 6px
		);
	}

	.year {
		margin-top: var(--space-2);
		font-size: var(--text-xs);
		color: var(--ink-soft);
		text-align: center;
		font-feature-settings: 'lnum' 1, 'tnum' 1;
	}

	.summary {
		margin: var(--space-3) 0 0;
		font-size: var(--text-sm);
		color: var(--ink-soft);
	}

	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
	}
</style>
