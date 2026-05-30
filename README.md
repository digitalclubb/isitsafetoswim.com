# isitsafetoswim.com

A plain-English verdict on UK water quality. Bathing waters, rivers and lakes.

## Stack

- pnpm, SvelteKit 2, TypeScript
- Biome for lint and format
- @vite-pwa/sveltekit for PWA
- Vanilla CSS (no Tailwind)
- Vitest for tests
- Deployed on Vercel via `@sveltejs/adapter-vercel`

## Data

- England: Environment Agency Bathing Water Quality (Linked Data)
- Wales: Natural Resources Wales (same stack)
- Scotland: SEPA scrape
- Northern Ireland: DAERA scrape
- Real-time sewage: water-company ArcGIS FeatureServers, plus Thames Water OAuth
- Rainfall and river levels: EA Flood Monitoring API

All data covered by the Open Government Licence v3. Attribution rendered per-page.

## Scripts

- `pnpm dev` - start the dev server
- `pnpm build` - rebuild the location index then bundle for production
- `pnpm data:index` - refresh the location index only
- `pnpm check` - typecheck
- `pnpm lint` / `pnpm lint:fix`
- `pnpm test`
