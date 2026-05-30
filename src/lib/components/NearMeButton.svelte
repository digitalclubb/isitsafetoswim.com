<script lang="ts">
	import { goto } from '$app/navigation';
	import { findNearestSlim } from '$lib/data/search-index';

	let busy = $state(false);
	let error = $state<string | null>(null);

	async function locate() {
		if (busy) return;
		error = null;
		if (typeof navigator === 'undefined' || !navigator.geolocation) {
			error = 'Geolocation is not available in this browser.';
			return;
		}
		busy = true;
		navigator.geolocation.getCurrentPosition(
			(position) => {
				const nearest = findNearestSlim(
					{ lat: position.coords.latitude, lon: position.coords.longitude },
					1
				)[0];
				busy = false;
				if (!nearest) {
					error = 'We could not find a bathing water near you.';
					return;
				}
				goto(`/swim/${nearest.location.slug}`);
			},
			(err) => {
				busy = false;
				error = err.code === err.PERMISSION_DENIED
					? 'Permission denied. Search by name instead.'
					: 'We could not get your location. Try search instead.';
			},
			{ timeout: 8_000, maximumAge: 5 * 60 * 1000 }
		);
	}
</script>

<button class="btn" type="button" onclick={locate} disabled={busy} aria-busy={busy}>
	<svg viewBox="0 0 24 24" aria-hidden="true" width="18" height="18">
		<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.6" />
		<circle cx="12" cy="12" r="2.4" fill="currentColor" />
		<path d="M12 1v3M12 20v3M1 12h3M20 12h3" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
	</svg>
	<span>{busy ? 'Finding nearest beach' : 'Use my location'}</span>
</button>

{#if error}
	<p class="error" role="alert" aria-live="polite">{error}</p>
{/if}

<style>
	.btn {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
		padding: var(--space-4) var(--space-5);
		min-height: 48px;
		background: var(--ink);
		color: var(--background);
		font-weight: 500;
		font-size: var(--text-md);
		border-radius: var(--radius);
		transition:
			background-color 120ms ease,
			transform 120ms cubic-bezier(0.2, 0.8, 0.2, 1);
	}

	.btn:hover:not(:disabled) {
		background: var(--link);
	}

	.btn:active:not(:disabled) {
		transform: translateY(1px);
		transition-duration: 60ms;
	}

	.btn:disabled {
		opacity: 0.7;
		cursor: progress;
	}

	.error {
		margin: var(--space-3) 0 0;
		font-size: var(--text-sm);
		color: var(--no);
	}
</style>
