<script lang="ts">
	import {
		comparableSpillYears,
		latestSpillYear,
		type SpillRecord,
		spillTrend
	} from '$lib/data/spill-history';

	let {
		record,
		locationName
	}: { record: SpillRecord; locationName: string } = $props();

	// The attributed figure is the EA's own link between an overflow and this
	// bathing water, so it is the only one stated as this beach's record. The
	// 10km figure is geography rather than hydrology, and reads far too high
	// inland and in cities, so it is offered as context and labelled as such.
	let years = $derived(comparableSpillYears(record.attributed));
	let latest = $derived(latestSpillYear(years));
	let trend = $derived(spillTrend(years));
	let nearbyLatest = $derived(latestSpillYear(record.nearby));

	let ceiling = $derived(Math.max(1, ...years.map((y) => y.spills)));
	let bars = $derived(
		years.map((entry) => ({
			...entry,
			height: Math.max(4, Math.round((entry.spills / ceiling) * 100))
		}))
	);

	let chartLabel = $derived(
		bars.length >= 2
			? `Counted spills a year from ${bars[0].year} to ${bars[bars.length - 1].year}: ${bars
					.map((b) => `${b.year}, ${b.spills}`)
					.join('; ')}.`
			: ''
	);

	function plural(n: number, one: string, many: string): string {
		return n === 1 ? one : many;
	}
</script>

{#if latest}
	<p class="lede">
		The Environment Agency links {latest.overflows}
		{plural(latest.overflows, 'storm overflow', 'storm overflows')} to {locationName}. In
		{latest.year} they discharged <strong>{latest.spills.toLocaleString('en-GB')}</strong>
		{plural(latest.spills, 'time', 'times')}.
	</p>

	{#if bars.length >= 2}
		<figure class="trend">
			<figcaption>Counted spills a year at the overflows feeding this bathing water.</figcaption>
			<div class="chart" role="img" aria-label={chartLabel}>
				{#each bars as bar (bar.year)}
					<div class="col" title={`${bar.year}: ${bar.spills.toLocaleString('en-GB')} spills`}>
						<span class="value">{bar.spills.toLocaleString('en-GB')}</span>
						<div class="bar" style={`height: ${bar.height}%`}></div>
						<span class="year">{bar.year}</span>
					</div>
				{/each}
			</div>
		</figure>
	{/if}

	{#if trend}
		<p class="muted small">
			{#if trend.changePct < 0}
				Down {Math.abs(trend.changePct)}% since {trend.from.year}, from {trend.from.spills.toLocaleString(
					'en-GB'
				)} spills to {trend.to.spills.toLocaleString('en-GB')}.
			{:else if trend.changePct > 0}
				Up {trend.changePct}% since {trend.from.year}, from {trend.from.spills.toLocaleString(
					'en-GB'
				)} spills to {trend.to.spills.toLocaleString('en-GB')}.
			{:else}
				Unchanged since {trend.from.year}, at {trend.to.spills.toLocaleString('en-GB')} spills.
			{/if}
		</p>
	{/if}
{:else if nearbyLatest}
	<p class="lede">
		The Environment Agency does not link any storm overflow directly to {locationName}, so
		there is no spill record for it. There were {nearbyLatest.overflows.toLocaleString('en-GB')}
		monitored overflows within ten kilometres in {nearbyLatest.year}, whether or not they drain
		here.
	</p>
{/if}

{#if latest && nearbyLatest}
	<p class="muted small">
		Counting every monitored overflow within ten kilometres instead, whether or not it drains
		here, gives {nearbyLatest.spills.toLocaleString('en-GB')} spills across
		{nearbyLatest.overflows.toLocaleString('en-GB')} overflows in {nearbyLatest.year}.
	</p>
{/if}

<style>
	.lede {
		margin: 0;
		max-width: 60ch;
	}

	.lede strong {
		font-weight: 600;
	}

	.trend {
		margin: var(--space-5) 0 0;
	}

	figcaption {
		font-family: var(--font-sans);
		font-size: var(--text-sm);
		color: var(--ink-soft);
		margin-bottom: var(--space-4);
	}

	.chart {
		display: flex;
		align-items: flex-end;
		gap: var(--space-3);
		height: 140px;
	}

	.col {
		flex: 1;
		display: flex;
		flex-direction: column;
		justify-content: flex-end;
		align-items: center;
		height: 100%;
		gap: 4px;
	}

	.bar {
		width: 100%;
		background: var(--no);
		/* The record is a warning, not a verdict, so it takes the tone at a
		   remove rather than the solid verdict red. */
		opacity: 0.75;
		min-height: 2px;
	}

	.value,
	.year {
		font-family: var(--font-sans);
		font-size: var(--text-xs);
		color: var(--ink-soft);
		font-variant-numeric: tabular-nums;
	}

	.small {
		font-size: var(--text-sm);
		margin: var(--space-4) 0 0;
	}
</style>
