<script lang="ts">
	import type { RecentSample } from '$lib/data/types';

	let { sample }: { sample: RecentSample } = $props();

	let formattedDate = $derived(formatDate(sample.sampledAt));

	function formatDate(iso: string): string {
		const t = Date.parse(iso);
		if (!Number.isFinite(t)) return iso;
		return new Date(t).toLocaleDateString('en-GB', {
			day: 'numeric',
			month: 'long',
			year: 'numeric'
		});
	}
</script>

<div class="sample">
	<p class="kicker">Latest sample · {formattedDate}</p>
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
