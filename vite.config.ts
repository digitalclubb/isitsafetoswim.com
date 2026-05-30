import { sveltekit } from '@sveltejs/kit/vite';
import { SvelteKitPWA } from '@vite-pwa/sveltekit';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	plugins: [
		sveltekit(),
		SvelteKitPWA({
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
					{
						src: '/icon.svg',
						sizes: 'any',
						type: 'image/svg+xml',
						purpose: 'any'
					},
					{
						src: '/icon.svg',
						sizes: 'any',
						type: 'image/svg+xml',
						purpose: 'maskable'
					}
				]
			},
			workbox: {
				globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
				navigateFallback: '/',
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
				enabled: false
			}
		})
	],
	test: {
		include: ['src/**/*.{test,spec}.{js,ts}', 'scripts/**/*.{test,spec}.{js,mjs,ts}']
	}
});
