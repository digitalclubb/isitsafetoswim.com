<script lang="ts">
	import { onMount } from 'svelte';
	import type { SearchLocation } from '$lib/data/search-index';
	import type { Verdict } from '$lib/data/types';
	import type { MapColours } from '$lib/map/types';
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

	// Someone asking what is near them wants today's answer, not a multi-year
	// average, so the cards carry the same precomputed verdict the map reads and
	// agree with the page they link to. Both /near routes are noindex and load on
	// the client, so there is no prerendered copy of this to go stale. Until the
	// blob arrives each card shows its annual rating, the same way the map holds
	// its pins neutral.
	// Two runs of the hourly cron plus slack. A blob older than this is dropped
	// rather than labelled "today", because presenting stale data as current is
	// the confusion these cards exist to avoid.
	const MAX_AGE_MS = 3 * 60 * 60 * 1000;

	let colours = $state<Record<string, Verdict>>({});
	let generatedAt = $state('');
	let showingVerdicts = $derived(results.some((r) => colours[r.location.id]));

	function formatTime(iso: string): string {
		const t = Date.parse(iso);
		if (!Number.isFinite(t)) return '';
		return new Date(t).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
	}

	onMount(async () => {
		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), 8000);
		try {
			const res = await fetch('/api/map', { signal: controller.signal });
			if (res.ok) {
				const blob: MapColours = await res.json();
				const age = Date.now() - Date.parse(blob.generatedAt);
				if (Number.isFinite(age) && age <= MAX_AGE_MS) {
					colours = blob.colours ?? {};
					generatedAt = blob.generatedAt;
				}
			}
		} catch {
			// The list still works; the cards keep their annual classification.
		} finally {
			clearTimeout(timer);
		}
	});
</script>

<section class="block container">
	<p class="kicker">Bathing waters near</p>
	<h1>{heading}</h1>

	{#if results.length > 0}
		<div class="card-grid">
			{#each results as result (result.location.id)}
				<LocationCard
					location={result.location}
					distanceMetres={result.distanceMetres}
					verdict={colours[result.location.id]}
				/>
			{/each}
		</div>
		<!-- The note tracks what the cards are actually showing: claiming verdicts
		     while a failed blob leaves ratings on screen is the confusion this
		     component exists to avoid. -->
		<p class="note">
			{#if showingVerdicts}
				Verdicts as of {formatTime(generatedAt)} today. Open a beach for the reasoning behind each
				one.
			{:else}
				Showing each site's annual classification. Open a beach for today's verdict.
			{/if}
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
