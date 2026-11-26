import adapter from '@sveltejs/adapter-cloudflare';
import { withPwa } from '@vite-pwa/sveltekit';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	plugins: [
		withPwa(
			{
				adapter: adapter(),
				prerender: {
					handleHttpError: 'warn',
					handleMissingId: 'warn',
					// '*' already covers every route without a required parameter, which
					// includes all four of these. They are named anyway, matching how
					// /sitemap.xml was already listed, so a rename cannot silently drop
					// one from the build.
					entries: [
						'*',
						'/sitemap.xml',
						'/sitemap-pages.xml',
						'/sitemap-swim.xml',
						'/sitemap-beaches.xml'
					]
				}
			},
			{
				registerType: 'autoUpdate',
				injectRegister: 'auto',
				strategies: 'generateSW',
				manifest: {
					name: 'Is It Safe To Swim?',
					short_name: 'SafeToSwim',
					description:
						'A plain-English verdict on UK water quality. Bathing waters, rivers and lakes, updated daily.',
					theme_color: '#0b1f2a',
					background_color: '#fbfaf6',
					display: 'standalone',
					start_url: '/',
					scope: '/',
					icons: [
						{ src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
						{ src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
						{
							src: '/icon-maskable-512.png',
							sizes: '512x512',
							type: 'image/png',
							purpose: 'maskable'
						},
						{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }
					]
				},
				generateSW: {
					// Nothing registers this worker yet (no virtual:pwa-register import), so
					// it is inert today. Kept to the app shell for when it is: a bare '**'
					// from .svelte-kit/output listed every file twice and swept in ~1,500
					// OG share images (57 MB). No navigation fallback either, or every page
					// not precached, including every on-demand location page, would be answered
					// with the homepage.
					globPatterns: [
						'client/_app/immutable/**/*.{js,css}',
						'client/{favicon,icon}*.{svg,png}',
						'client/*.webmanifest',
						'prerendered/pages/{index,about,map}.html'
					],
					navigateFallback: null,
					runtimeCaching: [
						{
							urlPattern: ({ url }) => url.pathname.startsWith('/api/verdict/'),
							handler: 'StaleWhileRevalidate',
							options: {
								cacheName: 'verdict-cache-v1',
								expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 6 }
							}
						}
					]
				},
				devOptions: {
					// Serve the manifest in dev so the <link rel="manifest"> tag does
					// not 404. The service worker still only matters in production.
					enabled: true,
					type: 'module',
					suppressWarnings: true,
					navigateFallback: '/'
				}
			}
		)
	],
	test: {
		include: ['src/**/*.{test,spec}.{js,ts}', 'scripts/**/*.{test,spec}.{js,mjs,ts}']
	}
});
