<script lang="ts">
	import LocationCard from '$lib/components/LocationCard.svelte';
	import { RATED_TIERS } from '$lib/data/rating';
	import type { Classification } from '$lib/data/types';
	import { safeJsonLd } from '$lib/seo/jsonLd';
	import { joinList } from '$lib/util/text';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const BASE = 'https://isitsafetoswim.com';

	let place = $derived(data.place);
	let count = $derived(data.ranked.length);

	function article(classification: Classification): string {
		return classification === 'Excellent' ? 'an' : 'a';
	}

	// Only the four genuine rating tiers belong in the summary sentence. New,
	// Unknown and Closed are statuses, not ratings. They still appear in the
	// full list below.
	let classSummary = $derived(
		joinList(
			data.countsByClass
				.filter((c) => (RATED_TIERS as readonly Classification[]).includes(c.classification))
				.map((c) => `${c.count} ${c.classification}`)
		)
	);

	let cleanCount = $derived(
		data.countsByClass
			.filter((c) => c.classification === 'Excellent' || c.classification === 'Good')
			.reduce((sum, c) => sum + c.count, 0)
	);

	let updatedLabel = $derived(
		new Date(data.generatedAt).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
	);

	// "Cleanest beaches in X" is what this page is actually asked for, and it is
	// demand that holds up outside the bathing season, unlike the daily verdict.
	let metaTitle = $derived(`Cleanest beaches in ${place.name}`);
	let metaDescription = $derived(
		`All ${count} designated bathing waters in ${place.name}, ranked by official water-quality classification, with a live verdict for each.`
	);

	let cleanestAnswer = $derived(
		data.cleanest.length > 0
			? `${data.cleanest[0].name} holds ${article(data.cleanest[0].classification)} ${data.cleanest[0].classification} classification, the regulator's top tier. ${cleanCount} of the ${count} bathing waters in ${place.name} are rated Excellent or Good.`
			: `No bathing water in ${place.name} currently holds an Excellent or Good classification.`
	);

	let countAnswer = $derived(
		classSummary
			? `${count}. The regulator's latest classifications are ${classSummary}.`
			: `${count}.`
	);

	let crumbs = $derived([
		{ name: 'Is it safe to swim?', url: `${BASE}/` },
		{ name: 'Cleanest beaches by area', url: `${BASE}/beaches` },
		...(data.parent ? [{ name: data.parent.name, url: `${BASE}/beaches/${data.parent.slug}` }] : []),
		{ name: place.name, url: `${BASE}/beaches/${place.slug}` }
	]);

	let jsonLd = $derived(
		[
			{
				'@context': 'https://schema.org',
				'@type': 'BreadcrumbList',
				itemListElement: crumbs.map((c, i) => ({
					'@type': 'ListItem',
					position: i + 1,
					name: c.name,
					item: c.url
				}))
			},
			data.cleanest.length > 0
				? {
						'@context': 'https://schema.org',
						'@type': 'ItemList',
						name: `Cleanest beaches in ${place.name}`,
						itemListElement: data.cleanest.map((c, i) => ({
							'@type': 'ListItem',
							position: i + 1,
							name: c.name,
							url: `${BASE}/swim/${c.slug}`
						}))
					}
				: null
		].filter(Boolean)
	);
</script>

<svelte:head>
	<title>{metaTitle} | Is it safe to swim?</title>
	<meta name="description" content={metaDescription} />
	<meta property="og:title" content={metaTitle} />
	<meta property="og:description" content={metaDescription} />
	<meta property="og:type" content="website" />
	<meta property="og:image" content={`https://isitsafetoswim.com/og/beaches/${place.slug}.png`} />
	<meta property="og:image:width" content="1200" />
	<meta property="og:image:height" content="630" />
	<meta property="og:url" content={`${BASE}/beaches/${place.slug}`} />
	<meta name="twitter:card" content="summary_large_image" />
	<link rel="canonical" href={`${BASE}/beaches/${place.slug}`} />
	{@html `<script type="application/ld+json">${safeJsonLd(jsonLd)}</script>`}
</svelte:head>

<article class="page">
	<div class="container">
		<p class="back"><a href="/beaches">← All areas</a></p>

		<header class="head">
			<h1>Cleanest beaches in {place.name}</h1>
			<p class="lede">
				{place.name} has {count} designated bathing waters.{classSummary
					? ` The regulator's latest classifications are ${classSummary}.`
					: ''}
			</p>
			<p class="updated">Updated {updatedLabel}</p>
		</header>

		<p class="more"><a href="/map">See the live UK beach map →</a></p>

		{#if data.cleanest.length > 0}
			<section class="block" aria-labelledby="cleanest">
				<h2 id="cleanest">Top rated</h2>
				<p class="muted">
					A selection rated Excellent or Good in the regulator's latest annual classification.
					Open any beach for today's live verdict.
				</p>
				<div class="card-grid">
					{#each data.cleanest as loc (loc.slug)}
						<LocationCard location={loc} />
					{/each}
				</div>
			</section>
		{/if}

		<section class="block" aria-labelledby="all">
			<h2 id="all">Every bathing water in {place.name}</h2>
			<div class="card-grid">
				{#each data.ranked as loc (loc.slug)}
					<LocationCard location={loc} />
				{/each}
			</div>
		</section>

		{#if data.childRegions.length > 0}
			<section class="block" aria-labelledby="areas">
				<h2 id="areas">Areas in {place.name}</h2>
				<ul class="areas">
					{#each data.childRegions as region (region.slug)}
						<li>
							<a href={`/beaches/${region.slug}`}>{region.name}</a>
							<span class="muted small">{region.count} bathing waters</span>
						</li>
					{/each}
				</ul>
			</section>
		{/if}

		<section class="block" aria-labelledby="faq">
			<h2 id="faq">Common questions</h2>
			<dl class="faq">
				<dt>Which beach is cleanest in {place.name}?</dt>
				<dd>{cleanestAnswer}</dd>
				<dt>How many bathing waters are in {place.name}?</dt>
				<dd>{countAnswer}</dd>
			</dl>
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

	.more {
		margin: var(--space-4) 0 0;
		font-size: var(--text-sm);
	}

	.more a {
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
		margin: 0 0 var(--space-3);
	}

	.updated {
		font-family: var(--font-sans);
		font-size: var(--text-xs);
		text-transform: uppercase;
		letter-spacing: 0.1em;
		color: var(--ink-soft);
		margin: 0;
	}

	.block {
		padding-block: var(--space-6);
		border-bottom: var(--rule-weight) solid var(--rule);
	}

	.block:last-of-type {
		border-bottom: none;
	}

	.block h2 {
		font-size: var(--text-xl);
		margin-bottom: var(--space-3);
	}

	.muted {
		color: var(--ink-soft);
		margin: 0 0 var(--space-4);
	}

	.card-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
		gap: var(--space-4);
	}

	.areas {
		list-style: none;
		padding: 0;
		margin: 0;
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
		gap: var(--space-3);
	}

	.areas li {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.small {
		font-size: var(--text-sm);
	}

	.faq {
		margin: 0;
	}

	.faq dt {
		font-family: var(--font-serif);
		font-size: var(--text-lg);
		margin-bottom: var(--space-2);
	}

	.faq dd {
		margin: 0 0 var(--space-4);
		color: var(--ink-soft);
		max-width: 60ch;
	}
</style>
