<script lang="ts">
	import type { VerdictResult } from '$lib/data/types';
	import { londonClock, londonDate, londonIsoDate, londonIsoDateTime } from '$lib/util/time';

	let {
		verdict,
		locationName,
		country,
		region
	}: {
		verdict: VerdictResult;
		locationName: string;
		country: string;
		region?: string;
	} = $props();

	let tone = $derived(
		verdict.verdict === 'yes' ? 'yes' : verdict.verdict === 'caution' ? 'caution' : 'no'
	);

	// An absolute clock time rather than "just now". The page is cached by ISR
	// for five minutes and served stale for longer, so a relative phrase is
	// already wrong by the time most visitors read it, and computing one during
	// render made the server and client HTML disagree.
	let formattedTime = $derived(londonClock(verdict.fetchedAt));
	let formattedDate = $derived(londonDate(verdict.fetchedAt));
	let isoDate = $derived(londonIsoDate(verdict.fetchedAt));
	let isoDateTime = $derived(londonIsoDateTime(verdict.fetchedAt));
</script>

<section class="verdict" data-tone={tone} aria-labelledby="verdict-head">
	<header class="head">
		<p class="kicker">
			<span class="dot" aria-hidden="true"></span>
			<span>{country}{region ? ` · ${region}` : ''}</span>
		</p>
		<p class="dateline"><time datetime={isoDate}>{formattedDate}</time></p>
	</header>

	<h1 class="name">{locationName}</h1>

	<p class="headline" id="verdict-head">
		<strong>{verdict.headline}</strong>
		<span class="reason">{verdict.reason}</span>
	</p>

	<p class="safety">
		<strong>Water quality only</strong>
		This says nothing about tides, rip currents, cold water shock or lifeguard cover. Cold water and
		currents are dangerous even when the water is clean. Read the local signs before you go in.
		<a href="/about#cannot-tell-you">What we cannot tell you</a>.
	</p>

	<div class="rule" aria-hidden="true"></div>

	<p class="updated">
		<!-- One flex item, so the row gap separates the phrase from the badge
		     rather than opening up between the label and the time. -->
		<span>Checked <time datetime={isoDateTime}>{formattedTime}</time> UK time</span>
		{#if verdict.dataAge === 'cached'}
			<span class="badge">cached</span>
		{:else if verdict.dataAge === 'unavailable'}
			<span class="badge warn">live data unavailable</span>
		{/if}
	</p>
</section>

<style>
	.verdict {
		padding: var(--space-7) 0 var(--space-6);
		border-top: var(--rule-weight-strong) solid var(--rule-strong);
		border-bottom: var(--rule-weight) solid var(--rule);
		position: relative;
	}

	.verdict::before {
		content: '';
		position: absolute;
		left: 0;
		top: 0;
		width: 64px;
		height: var(--rule-weight-strong);
		background: var(--tone-color, var(--ink));
		transform: translateY(-2px);
	}

	.verdict[data-tone='yes'] {
		--tone-color: var(--yes);
	}
	.verdict[data-tone='caution'] {
		--tone-color: var(--caution);
	}
	.verdict[data-tone='no'] {
		--tone-color: var(--no);
	}

	.head {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		gap: var(--space-4);
		margin-bottom: var(--space-3);
	}

	.kicker {
		font-family: var(--font-sans);
		font-size: var(--text-xs);
		text-transform: uppercase;
		letter-spacing: 0.12em;
		color: var(--ink-soft);
		margin: 0;
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
	}

	.dateline {
		font-family: var(--font-serif);
		font-style: italic;
		font-size: var(--text-sm);
		color: var(--ink-soft);
		margin: 0;
	}

	.dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--tone-color);
		display: inline-block;
	}

	.name {
		font-family: var(--font-serif);
		font-size: clamp(var(--text-2xl), 5vw, var(--text-3xl));
		margin: 0 0 var(--space-5);
		line-height: 1.05;
		font-feature-settings: 'kern' 1, 'liga' 1, 'lnum' 1;
	}

	.headline {
		font-family: var(--font-serif);
		font-size: clamp(var(--text-2xl), 6vw, var(--text-4xl));
		line-height: 1.04;
		letter-spacing: -0.02em;
		margin: 0;
		text-indent: -0.1em;
		font-feature-settings: 'kern' 1, 'liga' 1;
		hanging-punctuation: first;
	}

	.headline strong {
		color: var(--tone-color);
		font-weight: 700;
		margin-right: 0.18em;
	}

	.reason {
		color: var(--ink);
		font-weight: 400;
	}

	/* Deliberately not tinted with --tone-color. On a Yes verdict a green
	   panel reads as more reassurance, and this line exists to say the
	   opposite of whatever the verdict says. */
	.safety {
		margin: var(--space-5) 0 0;
		padding: var(--space-4);
		background: var(--surface-sunken);
		/* The fill alone does not lift in dark mode, where --surface-sunken sits
		   darker than the page, so the panel carries its own edge as well. */
		border: var(--rule-weight) solid var(--rule);
		border-left: 4px solid var(--ink);
		font-family: var(--font-sans);
		font-size: var(--text-base);
		line-height: 1.5;
		color: var(--ink);
	}

	.safety strong {
		display: block;
		font-size: var(--text-xs);
		text-transform: uppercase;
		letter-spacing: 0.12em;
		margin-bottom: var(--space-2);
	}

	.safety a {
		color: inherit;
	}

	.rule {
		width: 88px;
		height: var(--rule-weight-strong);
		background: var(--tone-color);
		margin: var(--space-5) 0 var(--space-3);
	}

	.updated {
		font-family: var(--font-sans);
		font-size: var(--text-sm);
		color: var(--ink-soft);
		margin: 0;
		display: inline-flex;
		gap: var(--space-3);
		align-items: center;
		text-transform: uppercase;
		letter-spacing: 0.1em;
	}

	.badge {
		display: inline-block;
		font-size: var(--text-xs);
		padding: 2px 8px;
		border-radius: 999px;
		background: var(--surface-sunken);
		color: var(--ink-soft);
		letter-spacing: 0.08em;
	}

	.badge.warn {
		background: var(--caution-soft);
		color: var(--caution);
	}

	@media (max-width: 540px) {
		.head {
			flex-direction: column;
			align-items: flex-start;
			gap: var(--space-2);
		}
	}
</style>
