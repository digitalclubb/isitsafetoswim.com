<script lang="ts">
	import type { RecentSample } from '$lib/data/types';
	import { eColiScaleCeiling, sampleBand } from '$lib/verdict/engine';

	let {
		samples,
		waterType = 'coastal'
	}: { samples: RecentSample[]; waterType?: 'coastal' | 'inland' } = $props();

	const TONE = { low: 'yes', elevated: 'caution', high: 'no' } as const;

	function shortDate(iso: string): string {
		const t = Date.parse(iso);
		if (!Number.isFinite(t)) return '';
		return new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
	}

	let ceiling = $derived(eColiScaleCeiling(waterType));
	let bars = $derived(
		samples
			.filter((s): s is RecentSample & { eColi: number } => typeof s.eColi === 'number')
			.map((s) => ({
				value: s.eColi,
				date: shortDate(s.sampledAt),
				tone: TONE[sampleBand(s.eColi, 'E. coli', waterType)],
				// Scale so the No threshold reaches ~85%; clean readings stay short, spikes max out.
				height: Math.min(100, Math.max(6, Math.round((s.eColi / ceiling) * 85)))
			}))
	);
	let label = $derived(
		bars.length >= 2
			? `E. coli over the last ${bars.length} samples, ranging ${Math.min(
					...bars.map((b) => b.value)
				)} to ${Math.max(...bars.map((b) => b.value))} cfu/100ml, most recent ${bars[bars.length - 1].value}.`
			: ''
	);
</script>

{#if bars.length >= 2}
	<figure class="trend">
		<figcaption>Recent E. coli readings (cfu/100ml). A taller bar is a worse result.</figcaption>
		<div class="chart" role="img" aria-label={label}>
			{#each bars as bar, i (i)}
				<div class="col" title={`${bar.date}: ${bar.value} cfu/100ml`}>
					<div class="bar" data-tone={bar.tone} style={`height: ${bar.height}%`}></div>
				</div>
			{/each}
		</div>
		<div class="axis">
			<span>{bars[0].date}</span>
			<span>{bars[bars.length - 1].date}</span>
		</div>
	</figure>
{/if}

<style>
	.trend {
		margin: var(--space-5) 0 0;
	}

	figcaption {
		font-size: var(--text-sm);
		color: var(--ink-soft);
		margin-bottom: var(--space-3);
	}

	.chart {
		display: flex;
		align-items: flex-end;
		gap: var(--space-2);
		height: 96px;
		padding-top: var(--space-2);
		border-bottom: var(--rule-weight) solid var(--rule);
	}

	.col {
		flex: 1;
		display: flex;
		align-items: flex-end;
		height: 100%;
	}

	.bar {
		width: 100%;
		min-height: 3px;
		border-radius: 2px 2px 0 0;
		background: var(--ink-muted);
	}

	.bar[data-tone='yes'] {
		background: var(--yes);
	}

	.bar[data-tone='caution'] {
		background: var(--caution);
	}

	.bar[data-tone='no'] {
		background: var(--no);
	}

	.axis {
		display: flex;
		justify-content: space-between;
		margin-top: var(--space-2);
		font-size: var(--text-xs);
		color: var(--ink-soft);
	}
</style>
