<svelte:head>
	<title>How the verdict is decided · Is it safe to swim?</title>
	<meta
		name="description"
		content="The methodology behind the Yes, Caution and No verdicts on isitsafetoswim.com. What data we use, where it comes from and the limits of what we can know."
	/>
	<link rel="canonical" href="https://isitsafetoswim.com/about" />
</svelte:head>

<article class="page container narrow">
	<header>
		<p class="kicker">About</p>
		<h1>How the verdict is decided</h1>
	</header>

	<section>
		<h2>The plain answer</h2>
		<p>
			Every UK bathing water gets a single verdict. <strong>Yes</strong> if the water is clean
			enough today, <strong>Caution</strong> if recent conditions could degrade quality, and
			<strong>No</strong> if there is active pollution or the annual classification is too poor to
			recommend swimming.
		</p>
		<p>
			The verdict is decided by software. We do not buy ratings, accept sponsored placements or
			adjust what the regulator says.
		</p>
	</section>

	<section>
		<h2>The four signals</h2>
		<ol>
			<li>
				<strong>Annual classification.</strong> Every site is graded Excellent, Good, Sufficient or
				Poor based on four years of bacterial sampling. The regulator publishes the result at the
				end of each bathing season.
			</li>
			<li>
				<strong>Daily pollution-risk forecast.</strong> During the bathing season the Environment
				Agency and Natural Resources Wales publish a same-day forecast that flags raised risk
				after expected short-term pollution events.
			</li>
			<li>
				<strong>Live sewage discharges.</strong> The water companies in England and Wales now
				publish near-real-time data from their storm-overflow monitors. We query the relevant
				operator for any event that started or finished within ten kilometres of the bathing
				water in the last 48 hours.
			</li>
			<li>
				<strong>Recent rainfall.</strong> Heavy rain washes pollution from land into rivers and the
				sea. We pull rainfall totals from the nearest Environment Agency flood-monitoring station
				and downgrade the verdict when totals are high.
			</li>
		</ol>
	</section>

	<section>
		<h2>Coverage</h2>
		<p>
			We cover every designated bathing water in the United Kingdom: 464 in England, 114 in Wales,
			90 in Scotland and 33 in Northern Ireland. The classifications come directly from the
			Environment Agency, Natural Resources Wales, SEPA and DAERA.
		</p>
		<p>
			Live sewage data and the daily risk forecast are presently available for England and Wales.
			Scottish Water and Northern Ireland Water publish summary data only. For Scotland and
			Northern Ireland the verdict relies on the regulator's classification, the rainfall signal
			and any directly observable activity, with a clear note that live storm-overflow data is
			not yet available.
		</p>
	</section>

	<section id="cannot-tell-you">
		<h2>What we cannot tell you</h2>
		<p>
			Bathing water classification measures bacteria. It does not measure chemicals, jellyfish,
			rip currents or temperature. A Yes verdict means the regulator's water-quality bar is
			likely cleared and there is no recent sewage discharge in range. It does not mean the water
			is risk-free. Always check tide times, lifeguard cover and local signs before entering the
			water.
		</p>
		<p>
			We update the live signals every five minutes. The regulator updates the daily risk forecast
			once per day during the bathing season. If a source goes down we degrade gracefully and tell
			you on the page.
		</p>
	</section>

	<section>
		<h2>Open data, open methodology</h2>
		<p>
			All the data we use is published under the Open Government Licence v3. We attribute the
			source on every page. There is nothing on this site you could not derive yourself from the
			same public APIs; we just present it in plain English so you can decide whether to swim.
		</p>
	</section>

	<section>
		<h2>Get in touch</h2>
		<p>
			Spotted a problem? Email <a href="mailto:hello@isitsafetoswim.com"
				>hello@isitsafetoswim.com</a
			>.
		</p>
	</section>
</article>

<style>
	.page {
		padding-block: var(--space-7);
	}

	.kicker {
		font-family: var(--font-sans);
		font-size: var(--text-xs);
		text-transform: uppercase;
		letter-spacing: 0.14em;
		color: var(--ink-soft);
		margin: 0 0 var(--space-2);
	}

	section {
		margin-top: var(--space-7);
		padding-top: var(--space-5);
		border-top: var(--rule-weight) solid var(--rule);
	}

	section:first-of-type {
		border-top: 0;
	}

	h2 {
		font-size: var(--text-xl);
		margin-bottom: var(--space-3);
	}

	ol {
		display: grid;
		gap: var(--space-3);
		padding-left: var(--space-5);
	}
</style>
