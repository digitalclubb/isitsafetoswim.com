<script lang="ts">
	/**
	 * Every other block on a page is computed from a regulator feed. This one is
	 * written by a person, so it is set in the serif face and signed.
	 *
	 * It deliberately wears none of the verdict palette. LocationCard already
	 * refuses to colour an annual classification in case it reads as today's
	 * answer, and a block asking for money has far less claim to those colours
	 * than that did. It is also built from a rule rather than a filled card,
	 * because every sibling block on these pages is separated by a rule and a
	 * panel would read as a widget bolted on afterwards.
	 */
	import { track } from '@vercel/analytics';

	let { variant = 'compact' }: { variant?: 'compact' | 'full' } = $props();

	const KOFI = 'https://ko-fi.com/digitalclubb';
	const SITE = 'https://digitalclubb.com';

	// Ko-fi is a link rather than their embedded widget, because that widget
	// sets third-party cookies and the about page now promises there are none.
	// A new tab keeps the verdict the reader came for, and the click is counted
	// first-party so the ask can be judged on its numbers rather than a guess.
	function countClick() {
		track('support_click', { placement: variant === 'full' ? 'about' : 'location' });
	}
</script>

<aside class="note" class:full={variant === 'full'} aria-labelledby="support-heading">
	{#if variant === 'full'}
		<h2 id="support-heading">Why this is free</h2>
		<p>
			I built this because I wanted to know where my own family could swim when we visit UK
			beaches. The data was already public but scattered across four regulators and a dozen water
			companies, so I put it in one place and gave it a plain answer.
		</p>
		<p>
			There are no adverts and no paywall. There never will be. I pay for the domain and the
			hosting myself.
		</p>
		<p>
			If this saved you a wasted trip or set your mind at rest, you can
			<a
				class="ask"
				href={KOFI}
				target="_blank"
				rel="external noopener"
				onclick={countClick}>buy me a coffee<span class="sr-only"> (opens in a new tab)</span></a
			>. A coffee goes towards the running costs.
		</p>
	{:else}
		<h2 id="support-heading">Built by one person</h2>
		<p>
			This site is free and always will be. There are no adverts and nothing to sign up for. I pay
			for the domain and the hosting, so if today's answer was useful you can
			<a
				class="ask"
				href={KOFI}
				target="_blank"
				rel="external noopener"
				onclick={countClick}>buy me a coffee<span class="sr-only"> (opens in a new tab)</span></a
			>.
		</p>
	{/if}

	<p class="sign">
		<span class="by">Gareth Clubb</span>
		{#if variant === 'full'}
			<a class="quiet" href={SITE} rel="external nofollow">digitalclubb.com</a>
			<a class="quiet" href={`${SITE}/writing`} rel="external nofollow">Writing</a>
		{/if}
	</p>
</aside>

<style>
	.note {
		margin-top: var(--space-7);
		padding-top: var(--space-5);
		border-top: var(--rule-weight-strong) solid var(--rule-strong);
	}

	h2 {
		font-family: var(--font-serif);
		font-size: var(--text-lg);
		font-weight: 600;
		letter-spacing: -0.01em;
		margin: 0 0 var(--space-3);
	}

	p {
		font-family: var(--font-serif);
		font-size: var(--text-md);
		line-height: var(--text-lh);
		color: var(--ink-soft);
		margin: 0 0 var(--space-3);
		max-width: 62ch;
	}

	.ask {
		color: var(--link);
		font-weight: 600;
	}

	.ask:hover {
		color: var(--link-hover);
	}

	.sign {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0 var(--space-4);
		margin-bottom: 0;
		font-family: var(--font-sans);
		font-size: var(--text-xs);
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--ink-muted);
	}

	.by {
		color: var(--ink);
		font-weight: 600;
	}

	/* Matches the 44px target the masthead and footer link lists already set. */
	.quiet {
		display: inline-flex;
		align-items: center;
		min-height: 44px;
		color: var(--ink-soft);
	}

	.quiet:hover {
		color: var(--link-hover);
	}

	.full h2 {
		font-size: var(--text-xl);
	}

	.full p {
		color: var(--ink);
	}
</style>
