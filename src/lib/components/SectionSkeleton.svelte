<script lang="ts">
	let {
		label,
		lines = 2
	}: {
		label: string;
		lines?: number;
	} = $props();
</script>

<div class="skeleton" role="status" aria-label={label}>
	<div class="lines" aria-hidden="true">
		{#each Array.from({ length: lines }) as _, i (i)}
			<span class="line" data-w={i % 3}></span>
		{/each}
	</div>
</div>

<style>
	.skeleton {
		padding: var(--space-4);
		border: var(--rule-weight) solid var(--rule);
		border-radius: var(--radius);
		background: var(--surface);
	}

	.lines {
		display: grid;
		gap: var(--space-3);
	}

	.line {
		display: block;
		height: 14px;
		border-radius: 999px;
		background: linear-gradient(
			90deg,
			var(--surface-sunken) 0%,
			var(--rule) 50%,
			var(--surface-sunken) 100%
		);
		background-size: 200% 100%;
		animation: shimmer 1600ms linear infinite;
	}

	.line[data-w='0'] {
		width: 92%;
	}

	.line[data-w='1'] {
		width: 76%;
	}

	.line[data-w='2'] {
		width: 84%;
	}

	@keyframes shimmer {
		0% {
			background-position: 100% 0;
		}
		100% {
			background-position: -100% 0;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.line {
			animation: none;
			background: var(--surface-sunken);
		}
	}
</style>
