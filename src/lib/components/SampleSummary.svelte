<script lang="ts">
	import type { RecentSample } from '$lib/data/types';
	import { londonFullDate, relativeDay } from '$lib/util/time';

	let { sample }: { sample: RecentSample } = $props();

	// London-pinned rather than formatted in the host timezone, which rendered
	// UTC on the server and the visitor's zone on the client, so a sample
	// timestamped near midnight changed day after hydration.
	let formattedDate = $derived(londonFullDate(sample.sampledAt));
	let recency = $derived(relativeDay(sample.sampledAt));
</script>

<div class="sample">
	<p class="kicker">Latest sample · {formattedDate}{recency ? ` · ${recency}` : ''}</p>
	<dl>
		{#if sample.eColi !== undefined}
			<div>
				<dt>E. coli</dt>
				<dd>{sample.eColi}<span class="unit"> cfu/100ml</span></dd>
			</div>
		{/if}
		{#if sample.intestinalEnterococci !== undefined}
			<div>
				<dt>Intestinal enterococci</dt>
				<dd>{sample.intestinalEnterococci}<span class="unit"> cfu/100ml</span></dd>
			</div>
		{/if}
	</dl>
</div>

<style>
	.sample {
		padding: var(--space-5);
		background: var(--surface);
		border: var(--rule-weight) solid var(--rule);
		border-radius: var(--radius-lg);
	}

	.kicker {
		font-size: var(--text-xs);
		text-transform: uppercase;
		letter-spacing: 0.1em;
		color: var(--ink-soft);
		margin: 0 0 var(--space-3);
	}

	dl {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
		gap: var(--space-4);
		margin: 0;
	}

	dt {
		font-size: var(--text-sm);
		color: var(--ink-soft);
		margin-bottom: 2px;
	}

	dd {
		margin: 0;
		font-family: var(--font-serif);
		font-size: var(--text-2xl);
		line-height: 1;
	}

	.unit {
		font-size: var(--text-sm);
		font-family: var(--font-sans);
		color: var(--ink-soft);
		margin-left: 4px;
		letter-spacing: 0;
	}
</style>
