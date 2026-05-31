<script lang="ts">
	import { seaTemperatureBand } from '$lib/live/temperature';

	let { celsius }: { celsius: number } = $props();

	let band = $derived(seaTemperatureBand(celsius));
</script>

<div class="temp" data-tone={band.tone}>
	<p class="reading">
		<span class="value">{celsius.toFixed(1)}°C</span>
		<span class="band">{band.label}</span>
	</p>
	{#if band.note}
		<p class="note">{band.note}</p>
	{/if}
	<p class="source">Sea surface, modelled by Open-Meteo.</p>
</div>

<style>
	.temp {
		padding: var(--space-5);
		background: var(--surface);
		border: var(--rule-weight) solid var(--rule);
		border-left: 4px solid var(--tone-color, var(--ink));
		border-radius: var(--radius-lg);
	}

	.temp[data-tone='yes'] {
		--tone-color: var(--yes);
	}
	.temp[data-tone='caution'] {
		--tone-color: var(--caution);
	}
	.temp[data-tone='no'] {
		--tone-color: var(--no);
	}
	.temp[data-tone='neutral'] {
		--tone-color: var(--rule-strong);
	}

	.reading {
		display: flex;
		align-items: baseline;
		gap: var(--space-3);
		margin: 0;
	}

	.value {
		font-family: var(--font-serif);
		font-size: var(--text-3xl);
		line-height: 1;
		font-feature-settings: 'lnum' 1;
	}

	.band {
		font-family: var(--font-sans);
		font-size: var(--text-sm);
		text-transform: uppercase;
		letter-spacing: 0.1em;
		color: var(--tone-color, var(--ink-soft));
	}

	.note {
		margin: var(--space-3) 0 0;
		font-size: var(--text-md);
		color: var(--ink);
	}

	.source {
		margin: var(--space-3) 0 0;
		font-size: var(--text-xs);
		color: var(--ink-soft);
	}
</style>
