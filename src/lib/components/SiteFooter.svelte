<script lang="ts">
	let { attribution = [] as string[] }: { attribution?: string[] } = $props();
</script>

<footer class="footer">
	<div class="container wide">
		<div class="grid">
			<div>
				<p class="brand">Is it safe to swim?</p>
				<p class="muted small">
					A plain-English verdict on water quality for UK bathing waters. Built by an
					independent developer, not affiliated with any regulator or water company.
				</p>
			</div>
			<div>
				<h3 class="hdg">Browse</h3>
				<ul class="links">
					<li><a href="/">Find a beach</a></li>
					<li><a href="/map">Map of every bathing water</a></li>
					<li><a href="/beaches">Cleanest beaches by area</a></li>
					<li><a href="/spills">Sewage spills happening now</a></li>
					<li><a href="/about">How the verdict works</a></li>
				</ul>
			</div>
			<div>
				<h3 class="hdg">Sources</h3>
				<ul class="links">
					<li><a href="https://environment.data.gov.uk/bwq/">Environment Agency (England)</a></li>
					<li>
						<a href="https://environment.data.gov.uk/wales/bathing-waters/"
							>Natural Resources Wales</a
						>
					</li>
					<li><a href="https://apps.sepa.org.uk/bathingwaters/">SEPA (Scotland)</a></li>
					<li>
						<a href="https://www.daera-ni.gov.uk/articles/bathing-water-quality-dashboard"
							>DAERA (Northern Ireland)</a
						>
					</li>
					<li>
						<a href="https://www.streamwaterdata.co.uk/pages/storm-overflows-data"
							>Storm overflows (Stream)</a
						>
					</li>
				</ul>
			</div>
		</div>

		{#if attribution.length > 0}
			<p class="attribution muted">
				{#each attribution as line, i (line)}
					{line}{i < attribution.length - 1 ? ' · ' : ''}
				{/each}
			</p>
		{/if}

		<p class="meta muted">
			© {new Date().getFullYear()} isitsafetoswim.com. Data is published under the Open
			Government Licence v3 unless stated otherwise.
		</p>
	</div>
</footer>

<style>
	.footer {
		margin-top: auto;
		background: var(--surface-sunken);
		border-top: var(--rule-weight) solid var(--rule);
		padding: var(--space-7) 0 var(--space-6);
	}

	.grid {
		display: grid;
		grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr) minmax(0, 1fr);
		gap: var(--space-6);
		padding-bottom: var(--space-5);
		border-bottom: var(--rule-weight) solid var(--rule);
	}

	.brand {
		font-family: var(--font-serif);
		font-size: var(--text-lg);
		margin: 0 0 var(--space-2);
	}

	.small {
		font-size: var(--text-sm);
	}

	.hdg {
		font-family: var(--font-sans);
		font-size: var(--text-xs);
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.12em;
		color: var(--ink-soft);
		margin: 0 0 var(--space-3);
	}

	.links {
		list-style: none;
		padding: 0;
		margin: 0;
		display: grid;
		gap: var(--space-1);
		font-size: var(--text-sm);
	}

	.links a {
		display: inline-flex;
		align-items: center;
		min-height: 44px;
		padding-block: var(--space-1);
	}

	.attribution {
		margin: var(--space-4) 0 0;
		font-size: var(--text-xs);
		line-height: 1.6;
	}

	.meta {
		font-size: var(--text-xs);
		margin: var(--space-2) 0 0;
	}

	/* Two columns would leave Sources alone on a second row with an empty cell
	 * beside it, so the blurb takes the full width and the two link lists pair
	 * up underneath. */
	@media (max-width: 880px) {
		.grid {
			grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
		}

		.grid > div:first-child {
			grid-column: 1 / -1;
		}
	}

	@media (max-width: 560px) {
		.grid {
			grid-template-columns: 1fr;
		}
	}
</style>
