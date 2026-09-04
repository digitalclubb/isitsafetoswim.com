<script lang="ts">
	import { safeJsonLd } from '$lib/seo/jsonLd';
	import { joinList } from '$lib/util/text';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let title = $derived(`Which beaches got worse in ${data.year}`);
	let canonical = 'https://isitsafetoswim.com/beaches/changes';
	let description = $derived(
		`${data.downgrades.length} bathing waters were downgraded and ${data.upgrades.length} upgraded in the ${data.year} classifications, against ${data.previousYear}. Every change across ${joinList(data.countries)}.`
	);

	let faq = $derived([
		{
			question: `How many beaches got worse in ${data.year}?`,
			answer: `${data.downgrades.length} of the ${data.compared} bathing waters that could be compared were rated lower in ${data.year} than in ${data.previousYear}. ${data.upgrades.length} were rated higher.`
		},
		{
			question: `Which beaches were downgraded in ${data.year}?`,
			answer:
				data.downgrades.length > 0
					? `${joinList(data.downgrades.slice(0, 5).map((d) => `${d.name}, from ${d.from} to ${d.to}`))}.`
					: `No bathing water was rated lower in ${data.year} than in ${data.previousYear}.`
		}
	]);

	let faqLd = $derived({
		'@context': 'https://schema.org',
		'@type': 'FAQPage',
		mainEntity: faq.map((item) => ({
			'@type': 'Question',
			name: item.question,
			acceptedAnswer: { '@type': 'Answer', text: item.answer }
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
	{@html `<script type="application/ld+json">${safeJsonLd(faqLd)}</script>`}
</svelte:head>

<article class="page">
	<div class="container">
		<p class="back"><a href="/beaches">← Beaches by area</a></p>

		<header class="head">
			<h1>Which beaches got worse in {data.year}</h1>
			<p class="lede">
				Every bathing water whose annual classification moved between {data.previousYear} and
				{data.year}. {data.downgrades.length} were rated lower and {data.upgrades.length} higher,
				out of {data.compared} that could be compared.
			</p>
		</header>

		<section class="block" aria-labelledby="down">
			<h2 id="down">Downgraded</h2>
			{#if data.downgrades.length > 0}
				<ol class="moves">
					{#each data.downgrades as row (row.slug)}
						<li>
							<span class="who">
								<a href={`/swim/${row.slug}`}>{row.name}</a>
								<span class="where">{row.region ?? row.country}</span>
							</span>
							<span class="move">
								<span class="from">{row.from}</span>
								<span class="arrow" aria-label="fell to">→</span>
								<span class="to" data-adverse={row.to === 'Poor'}>{row.to}</span>
							</span>
						</li>
					{/each}
				</ol>
			{:else}
				<p class="muted">No bathing water was rated lower than the year before.</p>
			{/if}
		</section>

		<section class="block" aria-labelledby="up">
			<h2 id="up">Upgraded</h2>
			{#if data.upgrades.length > 0}
				<ol class="moves">
					{#each data.upgrades as row (row.slug)}
						<li>
							<span class="who">
								<a href={`/swim/${row.slug}`}>{row.name}</a>
								<span class="where">{row.region ?? row.country}</span>
							</span>
							<span class="move">
								<span class="from">{row.from}</span>
								<span class="arrow" aria-label="rose to">→</span>
								<span class="to" data-good={true}>{row.to}</span>
							</span>
						</li>
					{/each}
				</ol>
			{:else}
				<p class="muted">No bathing water was rated higher than the year before.</p>
			{/if}
		</section>

		<section class="block" aria-labelledby="method">
			<h2 id="method">How this is worked out</h2>
			<p class="muted">
				The regulator republishes every bathing water's classification each November, as a
				percentile taken over readings from up to four bathing seasons. A change therefore
				reflects several years of sampling, not one bad afternoon, and a site can move without
				anything happening that summer.
			</p>
			<p class="muted">
				Covers {joinList(data.countries)}. Scotland's feed does not publish the previous year's
				classification and DAERA publishes no annual classification for Northern Ireland, so
				neither can be compared here.
			</p>
		</section>

		<section class="block" aria-labelledby="faq">
			<h2 id="faq">Common questions</h2>
			<dl class="faq">
				{#each faq as item (item.question)}
					<dt>{item.question}</dt>
					<dd>{item.answer}</dd>
				{/each}
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

	.moves {
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.moves li {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		align-items: baseline;
		gap: var(--space-2) var(--space-4);
		padding-block: var(--space-3);
		border-top: var(--rule-weight) solid var(--rule);
	}

	.moves li:first-child {
		border-top: 0;
	}

	.who a {
		text-decoration: none;
	}

	.where {
		display: block;
		font-size: var(--text-xs);
		color: var(--ink-soft);
	}

	.move {
		display: flex;
		align-items: baseline;
		gap: var(--space-2);
		font-family: var(--font-sans);
		font-size: var(--text-sm);
	}

	.from {
		color: var(--ink-soft);
	}

	.arrow {
		color: var(--rule-strong);
	}

	.to {
		font-weight: 600;
	}

	.to[data-adverse='true'] {
		color: var(--no);
	}

	.to[data-good='true'] {
		color: var(--yes);
	}

	.faq {
		margin: 0;
	}

	.faq dt {
		font-weight: 600;
		margin-top: var(--space-4);
	}

	.faq dd {
		margin: var(--space-2) 0 0;
		color: var(--ink-soft);
		max-width: 65ch;
	}

	.muted {
		color: var(--ink-soft);
		max-width: 65ch;
	}
</style>
