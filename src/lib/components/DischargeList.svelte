<script lang="ts">
	import type { DischargeEvent } from '$lib/data/types';

	let { discharges }: { discharges: DischargeEvent[] } = $props();

	function formatTime(iso: string): string {
		const t = Date.parse(iso);
		if (!Number.isFinite(t)) return '';
		const diff = Date.now() - t;
		const mins = Math.round(diff / 60000);
		if (mins < 60) return mins <= 1 ? 'a minute ago' : `${mins} minutes ago`;
		const hours = Math.round(mins / 60);
		if (hours < 24) return hours === 1 ? 'an hour ago' : `${hours} hours ago`;
		const days = Math.round(hours / 24);
		return days === 1 ? 'yesterday' : `${days} days ago`;
	}

	function formatDistance(metres: number): string {
		if (metres < 1000) return `${Math.round(metres / 100) * 100}m`;
		const km = metres / 1000;
		return km < 10 ? `${km.toFixed(1)}km` : `${Math.round(km)}km`;
	}
</script>

<ul class="list">
	{#each discharges as event, i (event.outfallName + i)}
		<li class:ongoing={event.ongoing}>
			<div class="when">
				<span class="dot" aria-hidden="true"></span>
				{#if event.ongoing}
					<strong>Ongoing</strong> since {formatTime(event.startedAt)}
				{:else if event.endedAt}
					Ended {formatTime(event.endedAt)}
				{:else}
					Started {formatTime(event.startedAt)}
				{/if}
			</div>
			<div class="what">
				{event.outfallName}
				{#if event.receivingWater}
					· into {event.receivingWater}
				{/if}
			</div>
			<div class="where muted">{formatDistance(event.distanceMetres)} from the bathing water</div>
		</li>
	{/each}
</ul>

<style>
	.list {
		list-style: none;
		padding: 0;
		margin: 0;
		display: grid;
		gap: var(--space-3);
	}

	li {
		display: grid;
		gap: 2px;
		padding: var(--space-4);
		border: var(--rule-weight) solid var(--rule);
		border-radius: var(--radius);
		background: var(--surface);
	}

	li.ongoing {
		border-color: var(--no);
		background: var(--no-soft);
	}

	.when {
		display: inline-flex;
		gap: var(--space-2);
		align-items: center;
		font-size: var(--text-sm);
	}

	.dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--caution);
		display: inline-block;
	}

	li.ongoing .dot {
		background: var(--no);
		animation: pulse 1.6s ease-in-out infinite;
	}

	.what {
		font-family: var(--font-serif);
		font-size: var(--text-lg);
	}

	.where {
		font-size: var(--text-sm);
	}

	@keyframes pulse {
		0%, 100% { opacity: 1; }
		50% { opacity: 0.45; }
	}
</style>
