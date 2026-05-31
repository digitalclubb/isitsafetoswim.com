<script lang="ts">
	import type { SearchLocation } from '$lib/data/search-index';
	import LocationCard from './LocationCard.svelte';

	let {
		heading,
		results,
		emptyMessage = 'We could not find any designated bathing waters near there.'
	}: {
		heading: string;
		results: Array<{ location: SearchLocation; distanceMetres: number }>;
		emptyMessage?: string;
	} = $props();
</script>

<section class="block container">
	<p class="kicker">Bathing waters near</p>
	<h1>{heading}</h1>

	{#if results.length > 0}
		<div class="card-grid">
			{#each results as result (result.location.id)}
				<LocationCard location={result.location} distanceMetres={result.distanceMetres} />
			{/each}
		</div>
		<p class="note">
			The badge shows each site's annual classification. Open a beach for today's live verdict.
		</p>
	{:else}
		<p class="empty">{emptyMessage}</p>
		<a class="back" href="/">Search by name instead</a>
	{/if}
</section>

<style>
	.kicker {
		font-family: var(--font-sans);
		font-size: var(--text-sm);
		text-transform: uppercase;
		letter-spacing: 0.14em;
		color: var(--ink-soft);
		margin: 0 0 var(--space-2);
	}

	h1 {
		font-family: var(--font-serif);
		font-size: clamp(var(--text-2xl), 6vw, var(--text-3xl));
		letter-spacing: -0.02em;
		margin: 0 0 var(--space-6);
	}

	.card-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
		gap: var(--space-4);
	}

	.note {
		margin: var(--space-5) 0 0;
		font-size: var(--text-sm);
		color: var(--ink-soft);
		max-width: 52ch;
	}

	.empty {
		font-size: var(--text-lg);
		color: var(--ink-soft);
		margin: 0 0 var(--space-4);
	}

	.back {
		font-family: var(--font-sans);
		font-size: var(--text-md);
		color: var(--ink);
	}
</style>
