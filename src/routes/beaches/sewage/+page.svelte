<script lang="ts">
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const title = 'Worst beaches for sewage in England';
	let description = $derived(
		`Every English bathing water ranked by the storm-overflow spills the Environment Agency links to it in ${data.year}. ${data.ranked} beaches ranked, ${data.totalSpills.toLocaleString('en-GB')} spills between them.`
	);
</script>

<svelte:head>
	<title>{title} | Is it safe to swim?</title>
	<meta name="description" content={description} />
	<meta property="og:title" content={title} />
	<meta property="og:description" content={description} />
	<meta property="og:type" content="website" />
	<meta property="og:image" content="https://isitsafetoswim.com/og.png" />
	<meta property="og:url" content="https://isitsafetoswim.com/beaches/sewage" />
	<meta name="twitter:card" content="summary_large_image" />
	<link rel="canonical" href="https://isitsafetoswim.com/beaches/sewage" />
</svelte:head>

<article class="page">
	<div class="container">
		<p class="back"><a href="/beaches">← Beaches by area</a></p>

		<header class="head">
			<h1>Worst beaches for sewage</h1>
			<p class="lede">
				English bathing waters ranked by the number of storm-overflow spills the Environment
				Agency links to them in {data.year}. Storm overflows are driven by rain, so they spill
				hardest in the months when nobody is swimming.
			</p>
		</header>

		<section class="block" aria-labelledby="worst">
			<h2 id="worst">Spills in {data.year}</h2>
			<ol class="league">
				{#each data.entries as row, i (row.slug)}
					<li>
						<span class="rank">{i + 1}</span>
						<span class="who">
							<a href={`/swim/${row.slug}`}>{row.name}</a>
							{#if row.region}<span class="where">{row.region}</span>{/if}
						</span>
						<span class="figure">
							<strong>{row.spills.toLocaleString('en-GB')}</strong>
							<span class="unit">
								from {row.overflows}
								{row.overflows === 1 ? 'overflow' : 'overflows'}
								{#if row.changePct !== null && row.changeFrom !== null}
									<span class="trend" data-dir={row.changePct > 0 ? 'up' : 'down'}>
										{row.changePct > 0 ? '+' : ''}{row.changePct}% since {row.changeFrom}
									</span>
								{/if}
							</span>
						</span>
					</li>
				{/each}
			</ol>
		</section>

		<section class="block" aria-labelledby="regions">
			<h2 id="regions">By area</h2>
			<ul class="regions">
				{#each data.regions as region (region.slug)}
					<li><a href={`/beaches/sewage/${region.slug}`}>{region.name}</a></li>
				{/each}
			</ul>
		</section>

		<section class="block" aria-labelledby="method">
			<h2 id="method">How this is counted</h2>
			<p class="muted">
				Each figure counts spills from the storm overflows the Environment Agency itself links
				to that bathing water in its annual Event Duration Monitoring return. That follows the
				sewer network rather than a map radius, so an overflow miles upstream counts and a
				nearby one draining elsewhere does not.
			</p>
			<p class="muted">
				{data.withRecord} of England's {data.total} bathing waters carry such a record, and
				{data.ranked} of those have a comparable {data.year} figure to be ranked on. A beach with
				no record is left out rather than shown as zero, because no record is not the same as a
				clean one. Wales, Scotland and Northern Ireland are absent because the return is an
				England publication.
			</p>
		</section>
	</div>
</article>

<style>
	.page {
		padding-block: var(--space-6) var(--space-7);
	}

	.back {
		margin: 0 0 var(--space-4);
		font-size: var(--text-sm);
	}

	.back a {
		text-decoration: none;
	}

	.head {
		padding-bottom: var(--space-6);
		border-bottom: var(--rule-weight-strong) solid var(--rule-strong);
	}

	h1 {
		font-family: var(--font-serif);
		font-size: clamp(var(--text-2xl), 5vw, var(--text-3xl));
		line-height: 1.05;
		margin: 0 0 var(--space-4);
	}

	.lede {
		font-size: var(--text-lg);
		color: var(--ink-soft);
		max-width: 60ch;
		margin: 0;
	}

	.block {
		padding-block: var(--space-5);
		border-bottom: var(--rule-weight) solid var(--rule);
	}

	.block:last-of-type {
		border-bottom: none;
	}

	.block h2 {
		font-size: var(--text-xl);
		margin-bottom: var(--space-3);
	}

	.league {
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.league li {
		display: grid;
		grid-template-columns: 2.5rem 1fr auto;
		align-items: baseline;
		gap: var(--space-3);
		padding-block: var(--space-3);
		border-top: var(--rule-weight) solid var(--rule);
	}

	.league li:first-child {
		border-top: 0;
	}

	.rank {
		font-family: var(--font-serif);
		font-size: var(--text-lg);
		color: var(--ink-soft);
		font-feature-settings: 'lnum' 1, 'tnum' 1;
	}

	.who a {
		text-decoration: none;
	}

	.where {
		display: block;
		font-size: var(--text-xs);
		color: var(--ink-soft);
	}

	.figure {
		text-align: right;
	}

	.figure strong {
		font-family: var(--font-serif);
		font-size: var(--text-xl);
		font-weight: 400;
		font-feature-settings: 'lnum' 1, 'tnum' 1;
	}

	.unit {
		display: block;
		font-size: var(--text-xs);
		color: var(--ink-soft);
	}

	.trend {
		display: block;
	}

	.trend[data-dir='up'] {
		color: var(--no);
	}

	.trend[data-dir='down'] {
		color: var(--yes);
	}

	.regions {
		list-style: none;
		padding: 0;
		margin: 0;
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
		gap: var(--space-2) var(--space-4);
	}

	.muted {
		color: var(--ink-soft);
		max-width: 65ch;
	}
</style>
