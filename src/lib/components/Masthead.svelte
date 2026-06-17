<script lang="ts">
	let { current = '' }: { current?: '' | 'home' | 'map' | 'spills' | 'about' } = $props();
</script>

<header class="masthead">
	<div class="container wide bar">
		<a class="brand" href="/">
			<span class="mark" aria-hidden="true">
				<svg viewBox="0 0 32 32" width="22" height="22" focusable="false">
					<title>Is It Safe To Swim wave mark</title>
					<rect width="32" height="32" rx="6" fill="currentColor" />
					<path
						d="M4 19c4-4 8-4 12 0s8 4 12 0"
						stroke="var(--background)"
						stroke-width="2.2"
						fill="none"
						stroke-linecap="round"
					/>
					<path
						d="M4 25c4-4 8-4 12 0s8 4 12 0"
						stroke="var(--background)"
						stroke-width="2.2"
						fill="none"
						stroke-linecap="round"
						opacity="0.55"
					/>
				</svg>
			</span>
			<span class="wordmark">
				Is it safe to swim<span class="punct">?</span>
			</span>
		</a>
		<nav aria-label="Primary">
			<a href="/" aria-current={current === 'home' ? 'page' : undefined}>Find a beach</a>
			<a href="/map" aria-current={current === 'map' ? 'page' : undefined}>Map</a>
			<a href="/spills" aria-current={current === 'spills' ? 'page' : undefined}>Spills</a>
			<a href="/about" aria-current={current === 'about' ? 'page' : undefined}>About</a>
		</nav>
	</div>
	<div class="rule" aria-hidden="true"></div>
</header>

<style>
	.masthead {
		background: var(--surface);
		border-bottom: var(--rule-weight) solid var(--rule);
	}

	.bar {
		display: flex;
		gap: var(--space-5);
		align-items: center;
		justify-content: space-between;
		padding-block: var(--space-4);
	}

	.brand {
		display: inline-flex;
		align-items: center;
		gap: var(--space-3);
		text-decoration: none;
		color: var(--ink);
		font-family: var(--font-serif);
		font-weight: 600;
		font-size: var(--text-lg);
		letter-spacing: -0.01em;
		font-feature-settings: 'kern' 1, 'liga' 1;
	}

	.punct {
		display: inline-block;
		transform: translateY(-0.04em);
	}

	.brand:hover {
		color: var(--link);
	}

	.mark {
		color: var(--ink);
		display: inline-flex;
	}

	.punct {
		color: var(--yes);
		font-style: italic;
	}

	nav {
		display: inline-flex;
		gap: var(--space-2);
		font-size: var(--text-sm);
	}

	nav a {
		color: var(--ink-soft);
		text-decoration: none;
		display: inline-flex;
		align-items: center;
		min-height: 44px;
		padding-inline: var(--space-3);
	}

	nav a:hover {
		color: var(--link);
	}

	nav a[aria-current='page'] {
		color: var(--ink);
		font-weight: 600;
	}

	.rule {
		height: 4px;
		background: linear-gradient(
			to right,
			var(--yes) 0 33%,
			var(--caution) 33% 66%,
			var(--no) 66%
		);
	}

	@media (max-width: 540px) {
		.bar {
			padding-block: var(--space-3);
		}
		.wordmark {
			font-size: var(--text-md);
		}
	}
</style>
