<script lang="ts">
	import { goto } from '$app/navigation';
	import type { SearchLocation } from '$lib/data/search-index';

	let {
		locations,
		placeholder = 'Search a beach, lake or town'
	}: { locations: readonly SearchLocation[]; placeholder?: string } = $props();

	let query = $state('');
	let focused = $state(false);
	let activeIndex = $state(-1);
	let listbox = $state<HTMLUListElement | null>(null);

	function foldDiacritics(input: string): string {
		return input.normalize('NFKD').replace(/[̀-ͯ]/g, '');
	}

	function isInsideContainer(target: EventTarget | null, container: HTMLElement | null): boolean {
		return Boolean(target instanceof Node && container?.contains(target));
	}

	let containerRef = $state<HTMLDivElement | null>(null);

	let results = $derived.by(() => {
		const q = foldDiacritics(query.trim().toLowerCase());
		if (q.length < 2) return [] as SearchLocation[];
		const scored: Array<{ loc: SearchLocation; score: number }> = [];
		for (const loc of locations) {
			const name = foldDiacritics(loc.name.toLowerCase());
			const region = foldDiacritics((loc.region ?? '').toLowerCase());
			let score = 0;
			if (name === q) score = 100;
			else if (name.startsWith(q)) score = 60;
			else if (name.includes(q)) score = 30;
			else if (region.includes(q)) score = 15;
			if (score > 0) scored.push({ loc, score });
		}
		scored.sort((a, b) => b.score - a.score || a.loc.name.localeCompare(b.loc.name, 'en-GB'));
		return scored.slice(0, 8).map((r) => r.loc);
	});

	function handleKeydown(e: KeyboardEvent) {
		if (results.length === 0) return;
		if (e.key === 'ArrowDown') {
			e.preventDefault();
			activeIndex = Math.min(activeIndex + 1, results.length - 1);
		} else if (e.key === 'ArrowUp') {
			e.preventDefault();
			activeIndex = Math.max(activeIndex - 1, 0);
		} else if (e.key === 'Enter') {
			e.preventDefault();
			const target = activeIndex >= 0 ? results[activeIndex] : results[0];
			if (target) goto(`/swim/${target.slug}`);
		} else if (e.key === 'Escape') {
			query = '';
			activeIndex = -1;
		}
	}

	function select(loc: SearchLocation) {
		goto(`/swim/${loc.slug}`);
	}
</script>

<div class="search" bind:this={containerRef}>
	<label class="sr-only" for="bw-search">Search for a UK bathing water</label>
	<input
		id="bw-search"
		type="search"
		autocomplete="off"
		spellcheck="false"
		bind:value={query}
		onkeydown={handleKeydown}
		onfocus={() => (focused = true)}
		onblur={(e) => {
			if (!isInsideContainer(e.relatedTarget, containerRef)) focused = false;
		}}
		role="combobox"
		aria-controls="bw-search-listbox"
		aria-expanded={focused && results.length > 0}
		aria-autocomplete="list"
		{placeholder}
	/>
	<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
		<circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" stroke-width="1.6" />
		<path d="M16 16l4 4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
	</svg>

	{#if focused && results.length > 0}
		<ul
			id="bw-search-listbox"
			role="listbox"
			class="results"
			bind:this={listbox}
		>
			{#each results as loc, i (loc.id)}
				<li role="presentation">
					<button
						type="button"
						role="option"
						aria-selected={i === activeIndex}
						class:active={i === activeIndex}
						onclick={() => select(loc)}
					>
						<span class="loc-name">{loc.name}</span>
						<span class="loc-meta">{loc.region ? `${loc.region} · ` : ''}{loc.country}</span>
					</button>
				</li>
			{/each}
		</ul>
	{/if}
</div>

<style>
	.search {
		position: relative;
	}

	input {
		width: 100%;
		padding: var(--space-4) var(--space-4) var(--space-4) calc(var(--space-7) + 4px);
		font-size: var(--text-lg);
		font-family: var(--font-sans);
		background: var(--surface);
		color: var(--ink);
		border: var(--rule-weight-strong) solid var(--rule-strong);
		border-radius: var(--radius);
	}

	input::placeholder {
		color: var(--ink-muted);
	}

	.icon {
		position: absolute;
		left: var(--space-4);
		top: 50%;
		transform: translateY(-50%);
		width: 22px;
		height: 22px;
		color: var(--ink-soft);
		pointer-events: none;
	}

	.results {
		position: absolute;
		top: calc(100% + 4px);
		left: 0;
		right: 0;
		background: var(--surface);
		border: var(--rule-weight) solid var(--rule-strong);
		border-radius: var(--radius);
		box-shadow: var(--shadow-card);
		list-style: none;
		padding: 4px;
		margin: 0;
		max-height: 360px;
		overflow: auto;
		z-index: 10;
	}

	.results button {
		width: 100%;
		text-align: left;
		padding: var(--space-3) var(--space-4);
		display: flex;
		flex-direction: column;
		gap: 2px;
		border-radius: var(--radius);
		cursor: pointer;
	}

	.results button:hover,
	.results button.active {
		background: var(--surface-sunken);
	}

	.loc-name {
		font-family: var(--font-serif);
		font-size: var(--text-lg);
	}

	.loc-meta {
		font-size: var(--text-sm);
		color: var(--ink-soft);
	}
</style>
