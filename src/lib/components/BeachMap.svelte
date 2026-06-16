<script lang="ts">
	import 'maplibre-gl/dist/maplibre-gl.css';
	import { env } from '$env/dynamic/public';
	import type { SearchLocation } from '$lib/data/search-index';
	import type { Verdict } from '$lib/data/types';
	import { UNKNOWN_HEX, verdictHex } from '$lib/map/colours';
	import { onMount } from 'svelte';

	let {
		points,
		colours,
		userLocation = null
	}: {
		points: readonly SearchLocation[];
		colours: Record<string, Verdict>;
		userLocation?: { lat: number; lon: number } | null;
	} = $props();

	// The UK basemap is served from static/uk.pmtiles by default. Override with
	// PUBLIC_BASEMAP_URL to point at a hosted file instead. Until the file exists
	// the request 404s harmlessly and the pins render on a plain background.
	const basemapUrl = env.PUBLIC_BASEMAP_URL || '/uk.pmtiles';

	let container: HTMLDivElement;
	// biome-ignore lint: the maplibre types are loaded dynamically below.
	let map: any = null;
	// biome-ignore lint: dynamic module handle reused by the location effect.
	let maplibre: any = null;
	// biome-ignore lint: marker handle.
	let userMarker: any = null;

	function collection() {
		return {
			type: 'FeatureCollection',
			features: points.map((p) => ({
				type: 'Feature',
				geometry: { type: 'Point', coordinates: [p.lon, p.lat] },
				properties: { slug: p.slug, name: p.name, verdict: colours[p.id] ?? 'unknown' }
			}))
		};
	}

	function verdictLabel(verdict: string): string {
		if (verdict === 'yes') return 'Yes';
		if (verdict === 'caution') return 'Caution';
		if (verdict === 'no') return 'No';
		return 'No data yet';
	}

	function escapeHtml(value: string): string {
		return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
	}

	onMount(() => {
		let cleanup = () => {};
		(async () => {
			maplibre = (await import('maplibre-gl')).default;
			const { Protocol } = await import('pmtiles');
			const { layers, GRAYSCALE } = await import('@protomaps/basemaps');

			maplibre.addProtocol('pmtiles', new Protocol().tile);

			// biome-ignore lint: style spec assembled dynamically.
			const sources: any = {
				beaches: { type: 'geojson', data: collection(), cluster: true, clusterRadius: 44, clusterMaxZoom: 9 }
			};
			// biome-ignore lint: layer list assembled dynamically.
			const base: any[] = [{ id: 'bg', type: 'background', paint: { 'background-color': '#eef1ec' } }];
			if (basemapUrl) {
				sources.protomaps = { type: 'vector', url: `pmtiles://${basemapUrl}` };
				// Drop symbol (label) layers so no glyph fonts are fetched from a CDN.
				base.push(...layers('protomaps', GRAYSCALE).filter((l: { type: string }) => l.type !== 'symbol'));
			}

			const beachLayers = [
				{
					id: 'clusters',
					type: 'circle',
					source: 'beaches',
					filter: ['has', 'point_count'],
					paint: {
						'circle-color': '#c2cabb',
						'circle-opacity': 0.9,
						'circle-stroke-width': 1,
						'circle-stroke-color': '#fbfaf6',
						'circle-radius': ['step', ['get', 'point_count'], 14, 25, 20, 75, 28]
					}
				},
				{
					id: 'unclustered',
					type: 'circle',
					source: 'beaches',
					filter: ['!', ['has', 'point_count']],
					paint: {
						'circle-radius': 6,
						'circle-stroke-width': 1.5,
						'circle-stroke-color': '#fbfaf6',
						'circle-color': [
							'match',
							['get', 'verdict'],
							'yes',
							verdictHex('yes'),
							'caution',
							verdictHex('caution'),
							'no',
							verdictHex('no'),
							UNKNOWN_HEX
						]
					}
				}
			];

			map = new maplibre.Map({
				container,
				style: { version: 8, sources, layers: [...base, ...beachLayers] },
				center: [-2.5, 54.2],
				zoom: 4.6,
				attributionControl: false
			});
			map.addControl(new maplibre.NavigationControl({ showCompass: false }), 'top-right');
			map.addControl(
				new maplibre.AttributionControl({
					customAttribution: basemapUrl ? '© OpenStreetMap, Protomaps' : ''
				})
			);

			// Re-apply the latest colours in case the blob resolved while the style
			// was still loading, when the source was not yet queryable by the effect.
			map.on('load', () => {
				map?.getSource('beaches')?.setData(collection());
			});

			map.on('click', 'clusters', (e: { point: [number, number] }) => {
				const feature = map.queryRenderedFeatures(e.point, { layers: ['clusters'] })[0];
				if (!feature) return;
				map
					.getSource('beaches')
					.getClusterExpansionZoom(feature.properties.cluster_id)
					.then((zoom: number) => {
						map.easeTo({ center: feature.geometry.coordinates, zoom });
					});
			});

			// biome-ignore lint: maplibre event payload.
			map.on('click', 'unclustered', (e: any) => {
				const feature = e.features[0];
				const { name, slug, verdict } = feature.properties;
				new maplibre.Popup({ closeButton: true, maxWidth: '240px' })
					.setLngLat(feature.geometry.coordinates)
					.setHTML(
						`<strong>${escapeHtml(name)}</strong><br>${verdictLabel(verdict)}<br><a href="/swim/${escapeHtml(slug)}">See the live verdict</a>`
					)
					.addTo(map);
			});

			for (const layer of ['clusters', 'unclustered']) {
				map.on('mouseenter', layer, () => {
					map.getCanvas().style.cursor = 'pointer';
				});
				map.on('mouseleave', layer, () => {
					map.getCanvas().style.cursor = '';
				});
			}

			cleanup = () => {
				map?.remove();
				map = null;
				maplibre?.removeProtocol?.('pmtiles');
			};
		})();
		return () => cleanup();
	});

	// Repaint when the colour blob arrives or changes after first render.
	$effect(() => {
		const data = collection();
		const source = map?.getSource('beaches');
		source?.setData(data);
	});

	// Centre on the user and drop a marker once they share their location.
	$effect(() => {
		if (!map || !maplibre || !userLocation) return;
		map.flyTo({ center: [userLocation.lon, userLocation.lat], zoom: 9 });
		userMarker?.remove();
		userMarker = new maplibre.Marker({ color: '#0b1f2a' })
			.setLngLat([userLocation.lon, userLocation.lat])
			.addTo(map);
	});
</script>

<div
	class="map"
	bind:this={container}
	aria-label="Map of UK bathing waters coloured by today's verdict. The list below gives the nearest safe beaches."
></div>

<style>
	.map {
		width: 100%;
		height: 60vh;
		min-height: 360px;
		border: var(--rule-weight) solid var(--rule);
		border-radius: var(--radius);
		overflow: hidden;
	}

	/* MapLibre defaults the popup to white, so pin its colours to the brand
	   tokens or the text is unreadable in dark mode (light ink on white). */
	:global(.maplibregl-popup-content) {
		background: var(--surface);
		color: var(--ink);
		font-family: var(--font-sans);
		font-size: var(--text-sm);
		padding: var(--space-3) var(--space-4);
		box-shadow: var(--shadow, 0 6px 18px -12px rgba(11, 31, 42, 0.3));
	}

	:global(.maplibregl-popup-content strong) {
		font-family: var(--font-serif);
		font-size: var(--text-base);
		color: var(--ink);
	}

	:global(.maplibregl-popup-content a) {
		color: var(--ink);
		text-decoration: underline;
	}

	:global(.maplibregl-popup-close-button) {
		color: var(--ink-soft);
		font-size: var(--text-lg);
		padding: 0 var(--space-2);
	}

	/* The tip is a CSS triangle made from borders; recolour the visible side per
	   anchor so it matches the surface rather than staying white. */
	:global(.maplibregl-popup-anchor-top .maplibregl-popup-tip),
	:global(.maplibregl-popup-anchor-top-left .maplibregl-popup-tip),
	:global(.maplibregl-popup-anchor-top-right .maplibregl-popup-tip) {
		border-bottom-color: var(--surface);
	}

	:global(.maplibregl-popup-anchor-bottom .maplibregl-popup-tip),
	:global(.maplibregl-popup-anchor-bottom-left .maplibregl-popup-tip),
	:global(.maplibregl-popup-anchor-bottom-right .maplibregl-popup-tip) {
		border-top-color: var(--surface);
	}

	:global(.maplibregl-popup-anchor-left .maplibregl-popup-tip) {
		border-right-color: var(--surface);
	}

	:global(.maplibregl-popup-anchor-right .maplibregl-popup-tip) {
		border-left-color: var(--surface);
	}
</style>
