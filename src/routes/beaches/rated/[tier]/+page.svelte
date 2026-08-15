<script lang="ts">
	import LocationCard from '$lib/components/LocationCard.svelte';
	import { safeJsonLd } from '$lib/seo/jsonLd';
	import { joinList } from '$lib/util/text';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const BASE = 'https://isitsafetoswim.com';

	/** An id needs no whitespace, and aria-labelledby reads spaces as separators. */
	function anchorId(country: string): string {
		return `c-${country.toLowerCase().replace(/\s+/g, '-')}`;
	}

	let article = $derived(data.tier === 'Excellent' ? 'an' : 'a');

	let countryBreakdown = $derived(
		joinList(data.byCountry.map((g) => `${g.locations.length} in ${g.country}`))
	);

	// One string behind both the visible answer and the JSON-LD, so the two can
	// never drift. Google expects the acceptedAnswer text to be on the page.
	let countAnswer = $derived(
		`${data.total} of the UK's ${data.catalogueTotal} designated bathing waters are rated ${data.tier}${
			countryBreakdown ? `: ${countryBreakdown}` : ''
		}.`
	);

	let updatedLabel = $derived(
		new Date(data.generatedAt).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
	);

	let others = $derived(data.siblings.filter((s) => s.slug !== data.slug));

	let metaTitle = $derived(`UK bathing waters rated ${data.tier}`);
	let metaDescription = $derived(
		`All ${data.total} designated UK bathing waters rated ${data.tier} in the latest annual classification, listed by country, with a live water-quality verdict for each.`
	);

	let crumbs = $derived([
		{ name: 'Is it safe to swim?', url: `${BASE}/` },
		{ name: 'Cleanest beaches by area', url: `${BASE}/beaches` },
		{ name: `Rated ${data.tier}`, url: `${BASE}/beaches/rated/${data.slug}` }
	]);

	let jsonLd = $derived([
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
		{
			'@context': 'https://schema.org',
			'@type': 'FAQPage',
			mainEntity: [
				{
					'@type': 'Question',
					name: `How many UK bathing waters are rated ${data.tier}?`,
					acceptedAnswer: { '@type': 'Answer', text: countAnswer }
				},
				{
					'@type': 'Question',
					name: `What does ${article} ${data.tier} bathing water classification mean?`,
					acceptedAnswer: { '@type': 'Answer', text: data.meaning }
				}
			]
		}
	]);
</script>

<svelte:head>
	<title>{metaTitle} | Is it safe to swim?</title>
	<meta name="description" content={metaDescription} />
	<meta property="og:title" content={metaTitle} />
	<meta property="og:description" content={metaDescription} />
	<meta property="og:type" content="website" />
	<meta property="og:image" content={`${BASE}/og.png`} />
	<meta property="og:image:width" content="1200" />
	<meta property="og:image:height" content="630" />
	<meta property="og:url" content={`${BASE}/beaches/rated/${data.slug}`} />
	<meta name="twitter:card" content="summary_large_image" />
	<link rel="canonical" href={`${BASE}/beaches/rated/${data.slug}`} />
	{@html `<script type="application/ld+json">${safeJsonLd(jsonLd)}</script>`}
</svelte:head>

<article class="page">
	<div class="container">
		<p class="back"><a href="/beaches">← All areas</a></p>

		<header class="head">
			<h1>UK bathing waters rated {data.tier}</h1>
			<p class="lede">
				{data.total} of the UK's {data.catalogueTotal} designated bathing waters hold {article}
				{data.tier} classification{countryBreakdown ? `: ${countryBreakdown}` : ''}.
			</p>
			<p class="meaning">{data.meaning}</p>
			<p class="updated">Updated {updatedLabel}</p>
		</header>

		<p class="more"><a href="/map">See the live UK beach map →</a></p>

		{#each data.byCountry as group (group.country)}
			<section class="block" aria-labelledby={anchorId(group.country)}>
				<h2 id={anchorId(group.country)}>
					{group.country}
					<span class="tally">{group.locations.length}</span>
				</h2>
				<div class="card-grid">
					{#each group.locations as loc (loc.slug)}
						<LocationCard location={loc} />
					{/each}
				</div>
			</section>
		{/each}

		<section class="block" aria-labelledby="other-ratings">
			<h2 id="other-ratings">The other classifications</h2>
			<ul class="areas">
				{#each others as sibling (sibling.slug)}
					<li>
						<a href={`/beaches/rated/${sibling.slug}`}>Rated {sibling.tier}</a>
						<span class="muted small">{sibling.count} bathing waters</span>
					</li>
				{/each}
			</ul>
		</section>

		<section class="block" aria-labelledby="faq">
			<h2 id="faq">Common questions</h2>
			<dl class="faq">
				<dt>How many UK bathing waters are rated {data.tier}?</dt>
				<dd>{countAnswer}</dd>
				<dt>What does {article} {data.tier} rating mean?</dt>
				<dd>{data.meaning}</dd>
				<dt>Does this rating tell me whether it is safe to swim today?</dt>
				<dd>
					No. The classification is a percentile over up to four bathing seasons, so it
					describes the water's record rather than today's conditions. Open any bathing water
					for a live verdict built from sewage discharges, rainfall and the latest sample.
				</dd>
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

	.meaning {
		max-width: 60ch;
		margin: 0 0 var(--space-4);
		padding-left: var(--space-4);
		border-left: var(--rule-weight-strong) solid var(--rule-strong);
		font-family: var(--font-sans);
		font-size: var(--text-sm);
		line-height: 1.5;
		color: var(--ink-soft);
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
		display: flex;
		align-items: baseline;
		gap: var(--space-3);
	}

	.tally {
		font-family: var(--font-sans);
		font-size: var(--text-xs);
		letter-spacing: 0.1em;
		color: var(--ink-soft);
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
