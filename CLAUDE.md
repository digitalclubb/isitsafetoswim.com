# Context for future Claude sessions

This file is the project briefing. Read it before doing any work.

## What this is

isitsafetoswim.com answers "is it safe to swim at X today?" for every designated UK bathing water with a single confident verdict (Yes / Caution / No), a plain-English reason and the underlying data. Built and run by Gareth Clubb as part of a portfolio of single-page SEO answer engines (isthisaromanroad.com, ispowercheap.co.uk, ispollenhigh.co.uk, isthisdodgy.co.uk).

Deployed to Vercel. ~700 designated bathing waters covered day one: England (EA), Wales (NRW), Scotland (SEPA), Northern Ireland (DAERA).

## Stack (locked)

- pnpm + SvelteKit 2 + Svelte 5 (runes) + TypeScript
- Biome for lint and format. **No** ESLint, no Prettier.
- Vanilla CSS with custom properties. **No Tailwind.** No CSS-in-JS.
- @vite-pwa/sveltekit for the manifest and service worker
- Vitest for unit tests
- @sveltejs/adapter-vercel
- @resvg/resvg-js for build-time SVG → PNG icon and OG card generation

If a future task wants to introduce Tailwind, a UI library or a different CSS approach, push back. The styling system is deliberately hand-crafted.

## Copy rules (non-negotiable)

All user-facing copy:

- British English (colour, organisation, behaviour).
- **No em dashes.** Use a comma, a full stop or restructure.
- **No Oxford commas.**
- **No commas before "and"** in lists.

Applies to: marketing copy, microcopy, error messages, schema.org descriptions, meta tags, README content shown to end users, and any prose written for the site. Code comments and internal docs are out of scope but it costs nothing to follow the rules there too.

## Design direction

GOV.UK credibility filtered through editorial typography. Distinctive, not AI-generic. See `.impeccable.md` for the full brand brief used by the impeccable skill chain.

Specifically avoid: gradient buttons, "modern SaaS" purple, glassmorphism, generic emoji-as-icon decoration, centred hero plus three-feature-grid, identical card grids, dot-separator stats strips, hero-metric templates. The mast-head three-stripe rule (green/amber/red) and the editorial verdict block are the brand's signature elements.

## Workflow

**Per-feature loop:** build the feature → run the agent-skills:code-reviewer agent → action high-confidence findings → commit to `main`. No PR review process, the reviewer agent is the second pair of eyes.

Do not batch unrelated work into one commit. Do not skip the review step to ship faster.

There is no `dev` branch. Commit directly to `main`.

## Architecture overview

```
isitsafetoswim.com/
├── scripts/
│   ├── build-location-index.mjs    Builds src/data/locations.json + search-index.json at build time
│   ├── generate-images.mjs         Renders icon.svg / og.svg to PNG variants
│   └── lib/parsers.mjs             Pure helpers shared with the build script (Vitest-tested)
│
├── src/
│   ├── data/                       Build outputs (do not edit by hand)
│   │   ├── locations.json          701 full records, server-only
│   │   └── search-index.json       Slim client-friendly subset (~22 KB gz)
│   │
│   ├── lib/
│   │   ├── data/                   Typed accessors over the JSON
│   │   ├── verdict/engine.ts       Pure verdict engine. 46 unit tests cover every branch.
│   │   ├── live/                   Server-side live data fetchers (EA profile, NRW profile,
│   │   │                            ArcGIS CSO feeds, EA flood-monitoring rainfall) and
│   │   │                            the buildLiveData orchestrator.
│   │   ├── components/             Svelte components. Scoped <style> per file.
│   │   └── styles/
│   │       ├── tokens.css          Design tokens (colour, type, space, containers, shadows)
│   │       └── app.css             Base reset and shared utilities
│   │
│   └── routes/
│       ├── +layout.svelte          Masthead + footer chrome
│       ├── +page.svelte            Homepage, prerendered
│       ├── about/                  About page, prerendered
│       ├── swim/[slug]/            Per-location page, Vercel ISR (5 min)
│       ├── api/verdict/[id]/       JSON endpoint, edge-cacheable
│       └── sitemap.xml/            Generated at build, all 703 URLs
```

## Verdict engine thresholds

In `src/lib/verdict/engine.ts`. Tuned via tests. Change with care.

| Constant | Value | Used for |
|---|---|---|
| `DISTANCE_NEARBY_M` | 2 000 | Reserved for tighter spatial gating in v2 |
| `DISTANCE_RELEVANT_M` | 5 000 | Ongoing or just-finished discharge → No |
| `DISTANCE_WIDER_M` | 10 000 | Recent discharge → Caution |
| `RECOVERY_WINDOW_HOURS` | 12 | A finished discharge inside this window still triggers No |
| `RECENT_WINDOW_HOURS` | 48 | Anything older drops out of the verdict |
| `HEAVY_RAIN_MM` | 15 | 24h rainfall → Caution |
| `NOTICEABLE_RAIN_MM` | 8 | 24h rainfall → mentioned but neutral |
| `E_COLI_CAUTION` | 500 | cfu/100ml → Caution |
| `E_COLI_NO` | 1 000 | cfu/100ml → No |

Bathing season runs 15 May to 30 September. Outside that window the verdict adds a Caution note that the official forecast is not in operation.

## Data sources and licensing

| Country | Endpoint | Auth | Licence |
|---|---|---|---|
| England (EA) | `environment.data.gov.uk/doc/bathing-water/{eubwid}.json` | None | OGL v3 |
| Wales (NRW) | `environment.data.gov.uk/wales/bathing-waters/doc/bathing-water/{eubwid}.json` | None | OGL v3 |
| Scotland (SEPA) | `map.sepa.org.uk/server/rest/services/Open/Environmental_Monitoring/MapServer/1/query` | None | SEPA open data |
| Northern Ireland (DAERA) | `services-eu1.arcgis.com/.../Bathing_Water_Monitoring_Points_Public_View_PRD/FeatureServer/0/query` | None | Crown copyright |
| Storm overflows (9 English + Welsh water companies) | Stream / ArcGIS FeatureServer per company | None | OGL v3 |
| Thames Water CSO | `api.thameswater.co.uk/opendata/v2/discharge/{status,alerts}` | OAuth (client credentials) | OGL v3 |
| Rainfall and river levels | `environment.data.gov.uk/flood-monitoring/...` | None | OGL v3 |

Attribution is rendered per location page via `src/lib/live/attribution.ts`. Do not strip the attribution lines.

Two or more concurrent regulator failures at build time are treated as fatal so a partial deploy never reaches production silently. A single transient outage falls through to the cached index in `scripts/.locations.cache.json`.

## URL shape

- `/` homepage, prerendered
- `/swim/[slug]` per-location page, Vercel ISR (5 min revalidation)
- `/api/verdict/[id]` JSON endpoint with `s-maxage=300, stale-while-revalidate=600`
- `/about` prerendered
- `/sitemap.xml` prerendered, 703 entries
- `/robots.txt`, `/manifest.webmanifest`, `/icon-*.png`, `/og.png`, `/favicon.svg`

## Commands

```sh
pnpm dev                # vite dev server
pnpm build              # build-location-index + generate-images + vite build
pnpm preview            # preview the production build locally
pnpm check              # svelte-check
pnpm test               # vitest run (46 tests)
pnpm lint               # biome check
pnpm lint:fix
pnpm format             # biome format --write
pnpm data:index         # refresh the location index only
pnpm data:images        # regenerate PNG icons and OG card
```

## Don't

- Don't introduce Tailwind, ESLint, Prettier, CSS-in-JS or a UI component library.
- Don't break the copy rules above. They are the most common source of regressions.
- Don't add features beyond what's asked, refactor adjacent systems as a side effect, or "clean up" code you don't fully understand. Surgical changes only.
- Don't write planning, decision or analysis Markdown files unless explicitly asked.
- Don't strip data-source attribution lines.
- Don't add a comment to explain what well-named code already says.
- Don't add backwards-compatibility shims, dead exports or unused vars marked with `_` after a refactor — just delete.

## Known follow-ups

Documented for future sessions, not blocking launch:

1. Wire Thames Water OAuth so London-area CSO data is included (currently falls through cleanly with no London discharges shown).
2. Per-location OG share cards rendered at build time via @resvg/resvg-js.
3. Postcode entry on the homepage alongside name search and geolocation.
4. A 7-day classification or sample sparkline on the location page.
5. SEPA and DAERA do not expose a per-site daily risk forecast; verdicts for Scotland and NI rely on classification, rainfall and any directly observable CSO data. When those regulators ship a forecast feed, plumb it through `src/lib/live/profile.ts`.
