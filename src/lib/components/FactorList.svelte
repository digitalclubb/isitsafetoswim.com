<script lang="ts">
	import type { VerdictFactor } from '$lib/data/types';

	let { factors }: { factors: VerdictFactor[] } = $props();
</script>

{#if factors.length > 0}
	<dl class="factors">
		{#each factors as factor (factor.label)}
			<div class="row" data-weight={factor.weight}>
				<dt>{factor.label}</dt>
				<dd>{factor.value}</dd>
			</div>
		{/each}
	</dl>
{/if}

<style>
	.factors {
		margin: 0;
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		border-top: var(--rule-weight) solid var(--rule);
	}

	.row {
		display: grid;
		grid-template-columns: minmax(160px, 0.6fr) minmax(0, 1fr);
		gap: var(--space-4);
		padding: var(--space-3) 0;
		border-bottom: var(--rule-weight) solid var(--rule);
		position: relative;
	}

	.row::before {
		content: '';
		position: absolute;
		left: -16px;
		top: 16px;
		bottom: 16px;
		width: 3px;
		background: transparent;
	}

	.row[data-weight='negative']::before {
		background: var(--no);
	}

	.row[data-weight='neutral']::before {
		background: var(--caution);
	}

	.row[data-weight='positive']::before {
		background: var(--yes);
	}

	dt {
		font-size: var(--text-sm);
		color: var(--ink-soft);
		text-transform: uppercase;
		letter-spacing: 0.08em;
	}

	dd {
		margin: 0;
		font-family: var(--font-serif);
		font-size: var(--text-lg);
		color: var(--ink);
	}

	@media (max-width: 540px) {
		.row {
			grid-template-columns: 1fr;
			gap: 4px;
			padding: var(--space-3) 0;
		}
	}
</style>
