<script lang="ts">
	import { safeJsonLd } from '$lib/seo/jsonLd';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let title = $derived(`Worst beaches for sewage in ${data.place.name}`);
	let description = $derived(
		`${data.ranked} bathing waters in ${data.place.name} ranked by the storm-overflow spills the Environment Agency links to them in ${data.year}, ${data.totalSpills.toLocaleString('en-GB')} spills between them.`
	);
	let canonical = $derived(`https://isitsafetoswim.com/beaches/sewage/${data.place.slug}`);

	// The table is the page, so it ships as an ItemList a crawler can read in
	// the same order the reader sees.
	let listLd = $derived({
		'@context': 'https://schema.org',
		'@type': 'ItemList',
		name: title,
		description,
		numberOfItems: Math.min(data.entries.length, 50),
		itemListOrder: 'https://schema.org/ItemListOrderDescending',
		itemListElement: data.entries.slice(0, 50).map((row, i) => ({
			'@type': 'ListItem',
			position: i + 1,
			name: row.name,
			url: `https://isitsafetoswim.com/swim/${row.slug}`
		}))
	});
</script>

<svelte:head>
	<title>{title} | Is it safe to swim?</title>
	<meta name="description" content={description} />
	<meta property="og:title" content={title} />
	<meta property="og:description" content={description} />
	<meta property="og:type" content="website" />
	<meta property="og:image" content="https://isitsafetoswim.com/og.png" />
	<meta property="og:url" content={canonical} />
	<meta name="twitter:card" content="summary_large_image" />
	<link rel="canonical" href={canonical} />
	{@html `<script type="application/ld+json">${safeJsonLd(listLd)}</script>`}
</svelte:head>

<article class="page">
	<div class="container">
		<p class="back"><a href="/beaches/sewage">← Worst beaches for sewage</a></p>

		<header class="head">
			<h1>Worst beaches for sewage in {data.place.name}</h1>
			<p class="lede">
				{data.ranked}
				{data.ranked === 1 ? 'bathing water' : 'bathing waters'} ranked by the storm-overflow
				spills the Environment Agency links to them in {data.year}.
				{#if data.ranked < data.total}
					The other {data.total - data.ranked} in {data.place.name} have no comparable {data.year}
					record, which is not the same as a clean one.
				{/if}
			</p>
		</header>

		<section class="block" aria-labelledby="table">
			<h2 id="table">Spills in {data.year}</h2>
			<ol class="league">
				{#each data.entries as row, i (row.slug)}
					<li>
						<span class="rank">{i + 1}</span>
						<span class="who">
							<a href={`/swim/${row.slug}`}>{row.name}</a>
							{#if row.region && data.place.kind === 'country'}
								<span class="where">{row.region}</span>
							{/if}
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

		{#if data.childRegions.length > 0}
			<section class="block" aria-labelledby="regions">
				<h2 id="regions">By area</h2>
				<ul class="regions">
					{#each data.childRegions as region (region.slug)}
						<li><a href={`/beaches/sewage/${region.slug}`}>{region.name}</a></li>
					{/each}
				</ul>
			</section>
		{/if}

		<section class="block" aria-labelledby="method">
			<h2 id="method">How this is counted</h2>
			<p class="muted">
				Each figure counts spills from the storm overflows the Environment Agency links to that
				bathing water in its annual Event Duration Monitoring return, so it follows the sewer
				network rather than a map radius. Spills only: the return's duration column is not
				reliable enough to publish.
			</p>
			<p class="muted">
				<a href={`/beaches/${data.place.slug}`}>See the cleanest beaches in {data.place.name}</a>
				or <a href="/spills">every spill happening now</a>.
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
