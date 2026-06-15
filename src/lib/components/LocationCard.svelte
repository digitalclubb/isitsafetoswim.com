<script lang="ts">
	import type { Classification, Country } from '$lib/data/types';

	interface CardLocation {
		slug: string;
		name: string;
		region?: string;
		country: Country;
		classification: Classification;
	}

	let { location, distanceMetres }: { location: CardLocation; distanceMetres?: number } = $props();

	const TONE: Record<Classification, 'yes' | 'caution' | 'no' | 'neutral'> = {
		Excellent: 'yes',
		Good: 'yes',
		Sufficient: 'caution',
		Poor: 'no',
		Closed: 'no',
		New: 'neutral',
		Unknown: 'neutral'
	};

	function formatKm(metres: number): string {
		const km = metres / 1000;
		return km < 10 ? `${km.toFixed(1)} km` : `${Math.round(km)} km`;
	}

	let tone = $derived(TONE[location.classification]);
	let place = $derived(location.region ?? location.country);
	let meta = $derived(distanceMetres != null ? `${place} · ${formatKm(distanceMetres)}` : place);
</script>

<a class="card" href={`/swim/${location.slug}`} data-tone={tone}>
	<span class="badge"><span class="sr-only">Classification: </span>{location.classification}</span>
	<span class="name">{location.name}</span>
	<span class="meta">{meta}</span>
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
