<script lang="ts">
	import type { VerdictResult } from '$lib/data/types';

	let {
		verdict,
		locationName,
		country,
		region,
		hydrating = false
	}: {
		verdict: VerdictResult;
		locationName: string;
		country: string;
		region?: string;
		hydrating?: boolean;
	} = $props();

	let tone = $derived(
		verdict.verdict === 'yes' ? 'yes' : verdict.verdict === 'caution' ? 'caution' : 'no'
	);

	let formattedTime = $derived(formatRelative(verdict.fetchedAt));
	let formattedDate = $derived(formatDate(verdict.fetchedAt));

	function formatRelative(iso: string): string {
		const t = Date.parse(iso);
		if (!Number.isFinite(t)) return '';
		const diffMins = Math.max(0, Math.round((Date.now() - t) / 60000));
		if (diffMins < 1) return 'just now';
		if (diffMins < 60) return `${diffMins} minute${diffMins === 1 ? '' : 's'} ago`;
		const hours = Math.round(diffMins / 60);
		if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
		const days = Math.round(hours / 24);
		return `${days} day${days === 1 ? '' : 's'} ago`;
	}

	function formatDate(iso: string): string {
		const t = Date.parse(iso);
		if (!Number.isFinite(t)) return '';
		return new Date(t).toLocaleDateString('en-GB', {
			weekday: 'long',
			day: 'numeric',
			month: 'long'
		});
	}
</script>

<section class="verdict" data-tone={tone} aria-labelledby="verdict-head">
	<header class="head">
		<p class="kicker">
			<span class="dot" aria-hidden="true"></span>
			<span>{country}{region ? ` · ${region}` : ''}</span>
		</p>
		<p class="dateline">{formattedDate}</p>
	</header>

	<h1 class="name">{locationName}</h1>

	<p class="headline" id="verdict-head">
		<strong>{verdict.headline}</strong>
		<span class="reason">{verdict.reason}</span>
	</p>

	<div class="rule" aria-hidden="true"></div>

	<p class="updated">
		Updated {formattedTime}
		{#if hydrating}
			<span class="badge live">
				<span class="pip" aria-hidden="true"></span>
				refreshing
			</span>
		{:else if verdict.dataAge === 'cached'}
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

	.badge.live {
		background: var(--surface-sunken);
		color: var(--ink-soft);
		display: inline-flex;
		align-items: center;
		gap: 6px;
	}

	.pip {
		display: inline-block;
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: var(--ink-soft);
		animation: pip-pulse 1200ms ease-in-out infinite;
	}

	@keyframes pip-pulse {
		0%,
		100% {
			opacity: 0.35;
		}
		50% {
			opacity: 1;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.pip {
			animation: none;
		}
	}

	@media (max-width: 540px) {
		.head {
			flex-direction: column;
			align-items: flex-start;
			gap: var(--space-2);
		}
	}
</style>
