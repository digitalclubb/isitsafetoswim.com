<script lang="ts">
	import { navigating } from '$app/state';

	// Show the bar only when navigation takes long enough to be worth noticing.
	// Anything shorter than ~120ms feels instant and a flash of progress is
	// worse than no progress at all.
	const VISIBLE_AFTER_MS = 120;

	let visible = $state(false);

	$effect(() => {
		if (!navigating.to) {
			visible = false;
			return;
		}
		const t = setTimeout(() => {
			visible = true;
		}, VISIBLE_AFTER_MS);
		return () => clearTimeout(t);
	});
</script>

<div class="track" aria-hidden="true" data-visible={visible}>
	{#key navigating.to?.url.pathname}
		<div class="bar"></div>
	{/key}
</div>

<style>
	.track {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		height: 3px;
		z-index: 100;
		pointer-events: none;
		opacity: 0;
		transition: opacity 160ms ease-out;
	}

	.track[data-visible='true'] {
		opacity: 1;
	}

	.bar {
		height: 100%;
		width: 0;
		background: var(--ink);
		transform-origin: left center;
	}

	.track[data-visible='true'] .bar {
		animation: progress 1400ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
	}

	@keyframes progress {
		0% {
			width: 0;
		}
		40% {
			width: 55%;
		}
		80% {
			width: 85%;
		}
		100% {
			width: 94%;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.bar {
			animation: none;
			width: 100%;
		}
	}
</style>
