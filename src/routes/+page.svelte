<script lang="ts">
	import LocationCard from '$lib/components/LocationCard.svelte';
	import NearMeButton from '$lib/components/NearMeButton.svelte';
	import SearchBox from '$lib/components/SearchBox.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>Is it safe to swim? Live UK water quality verdicts</title>
	<meta
		name="description"
		content="Plain-English Yes, Caution or No for over 700 designated UK bathing waters. Live sewage alerts, latest E. coli readings and the official daily pollution-risk forecast."
	/>
	<meta property="og:title" content="Is it safe to swim?" />
	<meta property="og:description" content="A plain-English verdict on UK water quality." />
	<meta property="og:type" content="website" />
	<meta property="og:image" content="https://isitsafetoswim.com/og.svg" />
	<meta property="og:url" content="https://isitsafetoswim.com/" />
	<meta name="twitter:card" content="summary_large_image" />
	<link rel="canonical" href="https://isitsafetoswim.com/" />
</svelte:head>

<section class="hero">
	<div class="container">
		<p class="kicker">A plain-English verdict on UK water quality</p>
		<h1>
			<span class="serif-large">Is it safe to swim<span class="punct">?</span></span>
		</h1>
		<p class="lede">
			A live answer for every designated bathing water in the United Kingdom. We combine the
			Environment Agency's classification, the latest sample and the official pollution forecast
			with real-time sewage discharge data from the water companies.
		</p>

		<div class="finder">
			<SearchBox locations={data.searchIndex} />
			<div class="finder-or">
				<span class="rule" aria-hidden="true"></span>
				<span>or</span>
				<span class="rule" aria-hidden="true"></span>
			</div>
			<NearMeButton />
		</div>

		<p class="stats">
			<strong>{data.meta.count}</strong> bathing waters covered ·
			<span>{data.meta.byCountry.England} England</span> ·
			<span>{data.meta.byCountry.Wales} Wales</span> ·
			<span>{data.meta.byCountry.Scotland} Scotland</span> ·
			<span>{data.meta.byCountry['Northern Ireland']} Northern Ireland</span>
		</p>
	</div>
</section>

<section class="block container">
	<div class="block-head">
		<h2>Popular places to check</h2>
		<p class="muted">The big names people search for most.</p>
	</div>
	<div class="card-grid">
		{#each data.featured as loc (loc.id)}
			<LocationCard location={loc} />
		{/each}
	</div>
</section>

<section class="block container">
	<div class="block-head">
		<h2>What we check, and how</h2>
	</div>
	<div class="explain">
		<article>
			<h3>1. The official classification</h3>
			<p>
				Every year the environment regulators rate each bathing water as Excellent, Good,
				Sufficient or Poor based on four years of bacteria readings. We use that as the baseline.
			</p>
		</article>
		<article>
			<h3>2. Today's pollution risk</h3>
			<p>
				During the bathing season the Environment Agency and Natural Resources Wales publish a
				daily forecast that flags raised risk after heavy rain, tidal events and other expected
				short-term pollution.
			</p>
		</article>
		<article>
			<h3>3. Sewage in the last 48 hours</h3>
			<p>
				We query each water company's live storm overflow feed for discharges within ten
				kilometres of the bathing water. An ongoing or recent event downgrades the verdict.
			</p>
		</article>
		<article>
			<h3>4. Rainfall</h3>
			<p>
				Heavy rain in the last 24 hours flushes pollutants into rivers and the sea. We pull
				rainfall from the nearest Environment Agency flood-monitoring station and factor it in.
			</p>
		</article>
	</div>
</section>

<style>
	.hero {
		padding: var(--space-8) 0 var(--space-7);
		background: linear-gradient(180deg, var(--background) 0%, var(--surface) 100%);
		border-bottom: var(--rule-weight) solid var(--rule);
	}

	.kicker {
		font-family: var(--font-sans);
		font-size: var(--text-sm);
		text-transform: uppercase;
		letter-spacing: 0.14em;
		color: var(--ink-soft);
		margin: 0 0 var(--space-3);
	}

	h1 {
		margin: 0 0 var(--space-5);
	}

	.serif-large {
		font-family: var(--font-serif);
		font-size: clamp(var(--text-3xl), 8vw, var(--text-4xl));
		line-height: 1.02;
		letter-spacing: -0.025em;
		display: block;
	}

	.punct {
		color: var(--yes);
	}

	.lede {
		font-size: var(--text-lg);
		line-height: 1.45;
		max-width: 56ch;
		color: var(--ink-soft);
		margin: 0 0 var(--space-7);
	}

	.finder {
		max-width: 520px;
	}

	.finder-or {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		font-size: var(--text-sm);
		color: var(--ink-soft);
		margin-block: var(--space-4);
		text-transform: uppercase;
		letter-spacing: 0.16em;
	}

	.finder-or .rule {
		flex: 1;
		height: 1px;
		background: var(--rule);
	}

	.stats {
		margin: var(--space-7) 0 0;
		font-size: var(--text-sm);
		color: var(--ink-soft);
	}

	.stats strong {
		color: var(--ink);
		font-weight: 600;
	}

	.stats span:not(:last-child)::after {
		content: '';
	}

	.block {
		padding: var(--space-7) var(--space-5);
	}

	.block-head {
		margin-bottom: var(--space-5);
	}

	.block-head h2 {
		margin-bottom: var(--space-2);
	}

	.card-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
		gap: var(--space-4);
	}

	.explain {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
		gap: var(--space-6);
	}

	.explain article h3 {
		font-size: var(--text-lg);
		margin-bottom: var(--space-2);
	}

	.explain article p {
		font-size: var(--text-md);
		color: var(--ink-soft);
		margin: 0;
	}
</style>
