<script lang="ts">
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	// Titled around "cleanest beaches in X", which is the demand these pages
	// answer and the phrasing that carries through the winter, rather than the
	// regulator's term for the same thing.
	const title = 'Cleanest beaches in the UK, by area';
	let total = $derived(data.countries.reduce((sum, g) => sum + g.country.count, 0));
	let description = $derived(
		`The cleanest beaches in every UK country and region, ranked by official water-quality classification, with a live verdict for all ${total} designated bathing waters.`
	);
</script>

<svelte:head>
	<title>{title} | Is it safe to swim?</title>
	<meta name="description" content={description} />
	<meta property="og:title" content={title} />
	<meta property="og:description" content={description} />
	<meta property="og:type" content="website" />
	<meta property="og:image" content="https://isitsafetoswim.com/og.png" />
	<meta property="og:url" content="https://isitsafetoswim.com/beaches" />
	<meta name="twitter:card" content="summary_large_image" />
	<link rel="canonical" href="https://isitsafetoswim.com/beaches" />
</svelte:head>

<article class="page">
	<div class="container">
		<p class="back"><a href="/">← Home</a></p>

		<header class="head">
			<h1>Cleanest beaches by area</h1>
			<p class="lede">
				Every designated bathing water in the UK, grouped by country and region. Each area page
				ranks its beaches by the regulator's official classification and links through to
				today's live verdict.
			</p>
		</header>

		<section class="block" aria-labelledby="by-change">
			<h2 id="by-change">What changed</h2>
			<p class="muted">
				<a href="/beaches/changes">Which beaches got better or worse</a> in the regulator's most
				recent annual classifications.
			</p>
		</section>

		<section class="block" aria-labelledby="by-sewage">
			<h2 id="by-sewage">By sewage record</h2>
			<p class="muted">
				<a href="/beaches/sewage">Worst beaches for sewage in England</a>, ranked on the
				storm-overflow spills the Environment Agency links to each bathing water.
			</p>
		</section>

		<section class="block" aria-labelledby="by-rating">
			<h2 id="by-rating">By classification</h2>
			<ul class="regions">
				{#each data.tiers as tier (tier.slug)}
					<li>
						<a href={`/beaches/rated/${tier.slug}`}>Rated {tier.tier}</a>
						<span class="muted small">{tier.count}</span>
					</li>
				{/each}
			</ul>
		</section>

		{#each data.countries as group (group.country.slug)}
			<section class="block" aria-labelledby={group.country.slug}>
				<h2 id={group.country.slug}>
					<a href={`/beaches/${group.country.slug}`}>{group.country.name}</a>
					<span class="muted small">{group.country.count} bathing waters</span>
				</h2>
				{#if group.regions.length > 0}
					<ul class="regions">
						{#each group.regions as region (region.slug)}
							<li>
								<a href={`/beaches/${region.slug}`}>{region.name}</a>
								<span class="muted small">{region.count}</span>
							</li>
						{/each}
					</ul>
				{/if}
			</section>
		{/each}
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
		display: flex;
		align-items: baseline;
		gap: var(--space-3);
	}

	.block h2 a {
		text-decoration: none;
	}

	.regions {
		list-style: none;
		padding: 0;
		margin: 0;
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
		gap: var(--space-2) var(--space-4);
	}

	.regions li {
		display: flex;
		align-items: baseline;
		gap: var(--space-2);
	}

	.small {
		font-size: var(--text-sm);
		font-weight: 400;
	}

	.muted {
		color: var(--ink-soft);
		max-width: 65ch;
		margin: 0;
	}
</style>
