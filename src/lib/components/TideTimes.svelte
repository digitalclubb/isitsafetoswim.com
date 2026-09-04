<script lang="ts">
	import type { TideInfo } from '$lib/data/types';
	import { londonClock, londonIsoDate, londonIsoDateTime, londonWeekday } from '$lib/util/time';

	let { tide }: { tide: TideInfo } = $props();

	// "Today" and "Tomorrow" beat a weekday for a short list, but only when they
	// are true: the model window ends at 23:00 UTC tomorrow, which is the day
	// after tomorrow in BST, so the last event can fall outside both. Compare
	// London calendar dates and fall back to a weekday rather than mislabelling.
	let todayKey = $derived(londonIsoDate(new Date().toISOString()));

	function dayLabel(at: string): string {
		const key = londonIsoDate(at);
		if (key === todayKey) return 'Today';
		const oneDayOn = londonIsoDate(new Date(Date.parse(`${todayKey}T12:00:00Z`) + 864e5).toISOString());
		return key === oneDayOn ? 'Tomorrow' : londonWeekday(at);
	}
</script>

<div class="tide">
	<p class="state">
		Tide is <strong>{tide.state}</strong>
	</p>
	<ol class="events">
		{#each tide.events as event (event.at)}
			<li>
				<span class="type" data-type={event.type}>
					{event.type === 'high' ? 'High water' : 'Low water'}
				</span>
				<time datetime={londonIsoDateTime(event.at)}>about {londonClock(event.at)}</time>
				<span class="day">{dayLabel(event.at)}</span>
			</li>
		{/each}
	</ol>
	<p class="source">
		Modelled by Open-Meteo and approximate. Checked against tide gauges these times ran
		up to half an hour early, so treat them as a guide to whether the water is coming in
		or going out, not as a tide table. For exact times see
		<a href="https://www.admiralty.co.uk/access-data/tidal-data/easy-tide" rel="nofollow noopener">
			Admiralty EasyTide
		</a>.
	</p>
</div>

<style>
	.tide {
		padding: var(--space-5);
		background: var(--surface);
		border: var(--rule-weight) solid var(--rule);
		border-left: 4px solid var(--rule-strong);
		border-radius: var(--radius-lg);
	}

	.state {
		margin: 0 0 var(--space-4);
		font-size: var(--text-md);
		color: var(--ink);
	}

	.state strong {
		font-weight: 600;
	}

	.events {
		margin: 0;
		padding: 0;
		list-style: none;
		display: grid;
		gap: var(--space-2);
	}

	.events li {
		display: grid;
		grid-template-columns: 1fr auto auto;
		align-items: baseline;
		gap: var(--space-3);
		padding-block: var(--space-2);
		border-top: var(--rule-weight) solid var(--rule);
	}

	.events li:first-child {
		border-top: 0;
	}

	.type {
		font-family: var(--font-sans);
		font-size: var(--text-sm);
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--ink-soft);
	}

	.type[data-type='high'] {
		color: var(--ink);
	}

	time {
		font-family: var(--font-serif);
		font-size: var(--text-xl);
		line-height: 1;
		font-feature-settings: 'lnum' 1, 'tnum' 1;
	}

	.day {
		font-size: var(--text-xs);
		color: var(--ink-soft);
		min-width: 4.5em;
		text-align: right;
	}

	.source {
		margin: var(--space-4) 0 0;
		font-size: var(--text-xs);
		color: var(--ink-soft);
	}
</style>
