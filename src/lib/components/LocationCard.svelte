<script lang="ts">
	import { onMount } from 'svelte';
	import { isAdverseRating, ratingLabel } from '#lib/data/rating.ts';
	import type { Classification, Country, CurrentAssessment } from '#lib/data/types.ts';
	import { verdictLabel } from '#lib/map/colours.ts';
	import { loadTodayVerdicts, today } from '#lib/map/today.svelte.ts';

	interface CardLocation {
		id: string;
		slug: string;
		name: string;
		region?: string;
		country: Country;
		classification: Classification;
		currentAssessment?: CurrentAssessment;
	}

	let { location, distanceMetres }: { location: CardLocation; distanceMetres?: number } = $props();

	onMount(loadTodayVerdicts);
	let verdict = $derived(today.colours[location.id]);

	function formatKm(metres: number): string {
		const km = metres / 1000;
		return km < 10 ? `${km.toFixed(1)} km` : `${Math.round(km)} km`;
	}

	let place = $derived(location.region ?? location.country);
	let meta = $derived(distanceMetres != null ? `${place} · ${formatKm(distanceMetres)}` : place);
	let rating = $derived(ratingLabel(location.classification, location.currentAssessment));
</script>

<!--
	Only a verdict may wear the verdict palette, and only a verdict sits in the
	badge corner. The classification is a multi-year percentile that says
	nothing about today, so it always renders as quiet text under the name: in
	the corner it read as the answer, and "Rated Good" over a beach that is a No
	today looked like a contradiction. The badge arrives after hydration from
	the hourly snapshot and stays empty without one.
-->
<a class="card" href={`/swim/${location.slug}`} data-tone={verdict}>
	{#if verdict}
		<span class="badge"><span class="sr-only">Verdict today: </span>{verdictLabel(verdict)}</span>
	{/if}
	<span class="name">{location.name}</span>
	<span class="meta">
		{meta}
		<span
			class="rating"
			class:adverse={isAdverseRating(location.classification, location.currentAssessment)}
			aria-label={rating.announced}>{rating.label}</span
		>
	</span>
</a>

<style>
	.card {
		display: grid;
		grid-template-columns: 1fr auto;
		grid-template-areas:
			'name badge'
			'meta meta';
		gap: var(--space-2) var(--space-3);
		padding: var(--space-4);
		background: var(--surface);
		border: var(--rule-weight) solid var(--rule);
		border-radius: var(--radius);
		text-decoration: none;
		color: var(--ink);
		transition:
			border-color 120ms ease,
			transform 140ms cubic-bezier(0.2, 0.8, 0.2, 1),
			box-shadow 140ms ease;
		will-change: transform;
	}

	@media (hover: hover) {
		.card:hover {
			border-color: var(--rule-strong);
			transform: translateY(-1px);
			box-shadow: 0 6px 18px -12px rgba(11, 31, 42, 0.18);
		}
	}

	.card:active {
		transform: translateY(1px);
		transition-duration: 60ms;
	}

	.name {
		grid-area: name;
		font-family: var(--font-serif);
		font-size: var(--text-lg);
		line-height: 1.2;
	}

	.meta {
		grid-area: meta;
		font-size: var(--text-sm);
		color: var(--ink-soft);
	}

	.badge {
		grid-area: badge;
		align-self: start;
		justify-self: end;
		font-size: var(--text-xs);
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		padding: 2px var(--space-2);
		border-radius: 999px;
		background: var(--surface-sunken);
		color: var(--ink-soft);
	}

	/* Deliberately not a pill: the rating must not read as a verdict badge. */
	.rating {
		display: block;
	}

	/* Poor and Closed have to stay legible as warnings without reaching for the
	   verdict palette, so they gain weight and contrast rather than colour. */
	.rating.adverse {
		color: var(--ink);
		font-weight: 600;
	}

	.card[data-tone='yes'] .badge {
		background: var(--yes-soft);
		color: var(--yes);
	}

	.card[data-tone='caution'] .badge {
		background: var(--caution-soft);
		color: var(--caution);
	}

	.card[data-tone='no'] .badge {
		background: var(--no-soft);
		color: var(--no);
	}
</style>
