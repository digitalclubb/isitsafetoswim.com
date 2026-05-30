# isitsafetoswim.com

A plain-English verdict on UK water quality. For every one of the 701 designated bathing waters in England, Wales, Scotland and Northern Ireland, the site answers a single question above the fold: **Yes, Caution or No.**

Built and run independently. Not affiliated with any regulator or water company.

## What it does

For each location the verdict engine combines four signals:

1. The official annual classification (Excellent, Good, Sufficient, Poor) from the relevant regulator.
2. The daily pollution-risk forecast published by the Environment Agency and Natural Resources Wales during the bathing season.
3. Storm-overflow discharges from the water companies within ten kilometres in the last 48 hours.
4. Rainfall in the last 24 hours at the nearest EA flood-monitoring station.

The output is one of `yes`, `caution` or `no` plus a single-sentence reason ("Sewage being discharged 1.5km away right now") and a factor breakdown. The engine is a pure TypeScript function with 46 unit tests covering every branch.

## Coverage

| Nation | Sites | Data source |
|---|---|---|
| England | 464 | Environment Agency Linked Data API |
| Wales | 114 | Natural Resources Wales Linked Data API |
| Scotland | 90 | SEPA ArcGIS MapServer |
| Northern Ireland | 33 | DAERA ArcGIS FeatureServer |
| **Total** | **701** | |

Real-time storm-overflow data covers the nine English and Welsh water companies that expose open ArcGIS FeatureServers. Thames Water's OAuth feed is a documented follow-up. Scottish Water and Northern Ireland Water publish summary data only so Scotland and NI verdicts currently rely on classification, rainfall and any directly observable activity.

## Stack

- pnpm + SvelteKit 2 + Svelte 5 (runes) + TypeScript
- Biome for lint and format
- Vanilla CSS with design tokens. No Tailwind.
- @vite-pwa/sveltekit for the PWA manifest and service worker
- @resvg/resvg-js to rasterise the brand SVG into PNG icons and a 1200x630 share card at build time
- Vitest for unit tests
- Deployed on Vercel via `@sveltejs/adapter-vercel`

## How it's built

```
/                     prerendered homepage with search, geolocation and methodology
/swim/[slug]          per-location page, Vercel ISR at 5 minute revalidation
/api/verdict/[id]     JSON endpoint, edge-cacheable with stale-while-revalidate
/about                methodology page, prerendered
/sitemap.xml          703 URLs, prerendered at build
```

The build step generates a unified location index from all four regulator APIs into `src/data/locations.json` (full, server-only) and a slim `src/data/search-index.json` (client-friendly, ~22 KB gzipped) used by the typeahead and the "use my location" lookup. Two or more concurrent regulator failures at build time fail the build so a partial deploy never reaches production. A single transient outage falls through to a cached index.

The location page server-renders the verdict so search engines and social previews see the answer directly. Schema.org Place JSON-LD is escaped at the script-tag boundary.

## Licensing and attribution

All data is published under the Open Government Licence v3.0. Per-page attribution lines are mandatory and are rendered by `src/lib/live/attribution.ts` for every location. They name the originating regulator (EA, NRW, SEPA or DAERA) and, when storm-overflow data is shown, the water-company storm-overflow programme.

## Scripts

```sh
pnpm dev                # vite dev server
pnpm build              # build-location-index + generate-images + vite build
pnpm preview            # preview the production build locally
pnpm check              # svelte-check
pnpm test               # vitest run
pnpm lint               # biome check
pnpm lint:fix           # biome check --write
pnpm format             # biome format --write
pnpm data:index         # refresh the location index only
pnpm data:images        # regenerate PNG icons and the OG card
```

## Contributing

See `CLAUDE.md` for the project briefing used by AI sessions and any human contributor: stack decisions, copy rules, verdict thresholds and the per-feature review-then-commit workflow.

See `.impeccable.md` for the brand brief used by the impeccable design skill chain.

## Code source

[Codeberg / GitHub URL pending]
