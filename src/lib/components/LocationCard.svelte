<script lang="ts">
	import type { Classification, Location } from '$lib/data/types';

	let { location }: { location: Location } = $props();

	const TONE: Record<Classification, 'yes' | 'caution' | 'no' | 'neutral'> = {
		Excellent: 'yes',
		Good: 'yes',
		Sufficient: 'caution',
		Poor: 'no',
		Closed: 'no',
		New: 'neutral',
		Unknown: 'neutral'
	};

	let tone = $derived(TONE[location.classification]);
</script>

<a class="card" href={`/swim/${location.slug}`} data-tone={tone}>
	<span class="badge">{location.classification}</span>
	<span class="name">{location.name}</span>
	<span class="meta">{location.region ?? location.country}</span>
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
		transition: border-color 120ms ease, transform 120ms ease;
	}

	.card:hover {
		border-color: var(--rule-strong);
		transform: translateY(-1px);
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
