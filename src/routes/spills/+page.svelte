<script lang="ts">
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let ongoing = $derived(data.spills.filter((s) => s.ongoing));
	let finished = $derived(data.spills.filter((s) => !s.ongoing));

	let headline = $derived(
		ongoing.length === 0
			? 'No storm overflows are discharging into a UK bathing water right now.'
			: ongoing.length === 1
				? '1 storm overflow is discharging into a UK bathing water right now.'
				: `${ongoing.length} storm overflows are discharging into UK bathing waters right now.`
	);

	const metaDescription =
		'A live count of the storm overflows currently discharging sewage near designated UK bathing waters and the beaches they affect.';

	function formatKm(metres: number): string {
		const km = metres / 1000;
		return km < 10 ? `${km.toFixed(1)} km` : `${Math.round(km)} km`;
	}

	function ago(iso: string): string {
		const t = Date.parse(iso);
		if (!Number.isFinite(t)) return '';
		const mins = Math.max(0, Math.round((Date.now() - t) / 60000));
		if (mins < 60) return `${mins} minute${mins === 1 ? '' : 's'} ago`;
		const hours = Math.round(mins / 60);
		return `${hours} hour${hours === 1 ? '' : 's'} ago`;
	}

	function updatedLabel(iso: string): string {
		const t = Date.parse(iso);
		if (!Number.isFinite(t)) return '';
		return new Date(t).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
	}
</script>

<svelte:head>
	<title>Sewage spills near UK bathing waters | Is it safe to swim?</title>
	<meta name="description" content={metaDescription} />
	<meta property="og:title" content="Sewage spills happening now" />
	<meta property="og:description" content={metaDescription} />
	<meta property="og:type" content="website" />
	<meta property="og:image" content="https://isitsafetoswim.com/og/spills.png" />
	<meta property="og:image:width" content="1200" />
	<meta property="og:image:height" content="630" />
	<meta property="og:url" content="https://isitsafetoswim.com/spills" />
	<meta name="twitter:card" content="summary_large_image" />
	<link rel="canonical" href="https://isitsafetoswim.com/spills" />
</svelte:head>

<article class="page">
	<div class="container">
		<header class="head">
			<h1>Sewage spills happening now</h1>
			<p class="count" data-active={ongoing.length > 0}>{headline}</p>
			<p class="lede">
				Storm overflows monitored within ten kilometres of a designated bathing water, from the
				water companies' near real-time feeds.{data.generatedAt
					? ` Updated ${updatedLabel(data.generatedAt)}.`
					: ''}
			</p>
			<p class="more"><a href="/map">See today's verdict for every beach on the map →</a></p>
		</header>

		{#if ongoing.length > 0}
			<section class="block" aria-labelledby="now">
				<h2 id="now">Discharging now</h2>
				<ul class="spills">
					{#each ongoing as s (s.beachSlug + s.outfallName)}
						<li>
							<a href={`/swim/${s.beachSlug}`}>
								<span class="dot" aria-hidden="true"></span>
								<span class="where">
									<span class="beach">{s.beachName}</span>
									<span class="meta">
										{s.outfallName}{s.receivingWater ? ` · ${s.receivingWater}` : ''} · {formatKm(
											s.distanceMetres
										)} away
									</span>
								</span>
								<span class="since">started {ago(s.startedAt)}</span>
							</a>
						</li>
					{/each}
				</ul>
			</section>
		{/if}

		{#if finished.length > 0}
			<section class="block" aria-labelledby="recent">
				<h2 id="recent" class="muted-h">Recently finished, last 48 hours</h2>
				<ul class="spills finished">
					{#each finished as s (s.beachSlug + s.outfallName)}
						<li>
							<a href={`/swim/${s.beachSlug}`}>
								<span class="where">
									<span class="beach">{s.beachName}</span>
									<span class="meta">
										{s.outfallName}{s.receivingWater ? ` · ${s.receivingWater}` : ''} · {formatKm(
											s.distanceMetres
										)} away
									</span>
								</span>
								<span class="since">ended {s.endedAt ? ago(s.endedAt) : ''}</span>
							</a>
						</li>
					{/each}
				</ul>
			</section>
		{/if}

		{#if data.spills.length === 0}
			<p class="muted empty">
				No storm-overflow discharges are being reported near a designated bathing water at the
				moment. Check an individual beach for its full live verdict.
			</p>
		{/if}

		<section class="block" aria-labelledby="about-data">
			<h2 id="about-data" class="muted-h">About this data</h2>
			<p class="muted small">
				Storm overflows are reported by the English and Welsh water companies and Thames Water
				under the Open Government Licence. A discharge does not always reach the bathing water,
				and reporting can lag. For the full picture at one beach, open its page for the live
				verdict and the regulator's profile.
			</p>
		</section>
	</div>
</article>

<style>
	.page {
		padding-block: var(--space-6) var(--space-7);
	}

	.head {
		padding-bottom: var(--space-5);
		border-bottom: var(--rule-weight-strong) solid var(--rule-strong);
	}

	h1 {
		font-family: var(--font-serif);
		font-size: clamp(var(--text-2xl), 5vw, var(--text-3xl));
		line-height: 1.05;
		margin: 0 0 var(--space-4);
	}

	.count {
		font-family: var(--font-serif);
		font-size: clamp(var(--text-xl), 3.5vw, var(--text-2xl));
		line-height: 1.15;
		margin: 0 0 var(--space-4);
		color: var(--ink);
	}

	.count[data-active='true'] {
		color: var(--no);
	}

	.lede {
		font-size: var(--text-base);
		color: var(--ink-soft);
		max-width: 60ch;
		margin: 0;
	}

	.more {
		margin: var(--space-4) 0 0;
		font-size: var(--text-sm);
	}

	.more a {
		text-decoration: none;
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
		margin-bottom: var(--space-4);
	}

	.muted-h {
		color: var(--ink-soft);
		font-size: var(--text-lg) !important;
		font-weight: 500;
	}

	.spills {
		list-style: none;
		padding: 0;
		margin: 0;
		display: grid;
		gap: var(--space-2);
	}

	.spills a {
		display: grid;
		grid-template-columns: auto 1fr auto;
		align-items: baseline;
		gap: var(--space-3);
		padding: var(--space-3) var(--space-4);
		border: var(--rule-weight) solid var(--rule);
		border-radius: var(--radius);
		text-decoration: none;
		color: var(--ink);
	}

	.finished a {
		grid-template-columns: 1fr auto;
	}

	@media (hover: hover) {
		.spills a:hover {
			border-color: var(--rule-strong);
		}
	}

	.dot {
		width: 10px;
		height: 10px;
		border-radius: 50%;
		background: var(--no);
		align-self: center;
	}

	.beach {
		font-family: var(--font-serif);
		font-size: var(--text-lg);
		display: block;
	}

	.meta {
		font-size: var(--text-sm);
		color: var(--ink-soft);
	}

	.since {
		font-size: var(--text-sm);
		color: var(--ink-soft);
		white-space: nowrap;
		text-align: right;
	}

	.muted {
		color: var(--ink-soft);
		max-width: 60ch;
	}

	.small {
		font-size: var(--text-sm);
	}

	.empty {
		padding-block: var(--space-6);
	}
</style>
