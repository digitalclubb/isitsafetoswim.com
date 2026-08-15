# Context for future Claude sessions

This file is the project briefing. Read it before doing any work.

## What this is

isitsafetoswim.com answers "is it safe to swim at X today?" for every designated UK bathing water with a single confident verdict (Yes / Caution / No), a plain-English reason and the underlying data. Built and run by Gareth Clubb as part of a portfolio of single-page SEO answer engines (isthisaromanroad.com, ispowercheap.co.uk, ispollenhigh.co.uk, isthisdodgy.co.uk).

Deployed to Vercel. ~700 designated bathing waters covered day one: England (EA), Wales (NRW), Scotland (SEPA), Northern Ireland (DAERA).

## Stack (locked)

- pnpm + SvelteKit 2 + Svelte 5 (runes) + TypeScript
- Biome for lint and format, scoped to TS/JS/JSON. **No** ESLint, no Prettier. Biome does not lint `.svelte` files (its Svelte support is partial and flags template-used props as unused); `svelte-check` (`pnpm check`) validates those.
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
│   ├── lib/parsers.mjs             Pure helpers shared with the build script (Vitest-tested)
│   └── lib/display-names.mjs       Slug-keyed overrides for regulator names nobody searches
│
├── src/
│   ├── data/                       Build outputs (do not edit by hand)
│   │   ├── locations.json          701 full records, server-only
│   │   └── search-index.json       Slim client-friendly subset (~22 KB gz)
│   │
│   ├── lib/
│   │   ├── data/                   Typed accessors over the JSON (incl. places.ts for area pages)
│   │   ├── verdict/engine.ts       Pure verdict engine. Unit tests cover every branch.
│   │   ├── live/                   Server-side live data fetchers (EA profile, NRW profile,
│   │   │                            ArcGIS CSO feeds, EA flood-monitoring rainfall) and
│   │   │                            the buildLiveData orchestrator + deriveVerdict.
│   │   ├── map/                    Map precompute: Redis store (kv.ts), hourly colour compute,
│   │   │                            daily profile cache, nearest-safe, colour tokens.
│   │   ├── components/             Svelte components. Scoped <style> per file (BeachMap.svelte = MapLibre).
│   │   ├── seo/                    jsonLd.ts escaping, sitemap.ts urlset and index builders
│   │   ├── util/                   Small shared helpers (pool.ts concurrency, time.ts London formatters)
│   │   └── styles/
│   │       ├── tokens.css          Design tokens (colour, type, space, containers, shadows)
│   │       └── app.css             Base reset and shared utilities
│   │
│   └── routes/
│       ├── +layout.svelte          Masthead + footer chrome
│       ├── +page.svelte            Homepage, prerendered
│       ├── about/                  About page, prerendered
│       ├── swim/[slug]/            Per-location page, Vercel ISR (5 min)
│       ├── map/                    Interactive map + nearest-safe list
│       ├── beaches/                Area hubs (/beaches, /beaches/[place])
│       ├── near/                   Geolocation + postcode results
│       ├── api/verdict/[id]/       JSON endpoint, edge-cacheable
│       ├── api/map/                Precomputed colour blob
│       ├── api/cron/               refresh-map (hourly), refresh-profiles (daily)
│       └── sitemap*.xml/           Index at /sitemap.xml plus a child per section
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
| `HEAVY_RAIN_MM` | 15 | 24h rainfall → Caution (only when the site is `rainImpacted`) |
| `NOTICEABLE_RAIN_MM` | 8 | 24h rainfall → mentioned but neutral |

The latest sample is assessed on both E. coli and intestinal enterococci, taking the worse of the two, against `SAMPLE_THRESHOLDS` which differ by water type (cfu/100ml):

| Water type | Parameter | Elevated → Caution | High → No |
|---|---|---|---|
| Coastal | E. coli | 500 | 1 000 |
| Coastal | Intestinal enterococci | 200 | 400 |
| Inland | E. coli | 1 000 | 2 000 |
| Inland | Intestinal enterococci | 400 | 800 |

There is no statutory single-sample standard (classification is a multi-year percentile), so these adopt the revised Bathing Water Directive percentile boundaries as proxy cut-offs: elevated at the Good 95th-percentile boundary, high at roughly twice it. Unknown water type defaults to the stricter coastal cut-offs.

A sample stops deciding the verdict once it is older than `SAMPLE_CURRENT_DAYS` (28). It is still reported as a factor, so a high reading from late September is visible all winter without holding the beach at No until May. A sample with no usable date fails safe and keeps deciding, because `parseSample` in `src/lib/live/profile.ts` can emit `sampledAt: ''` alongside real counts, and a reading we cannot age is likelier to be current than a year old.

Bathing season runs 15 May to 30 September. **Out of season the closed season is a neutral factor, never a verdict.** It used to push a Caution, which meant every clean site read "Caution. Outside bathing season, the official forecast is not in operation." from 1 October to 15 May. Only about a tenth of the demand behind these pages carries "today"; the rest asks how clean the water is, and that stays answerable from the classification, live storm-overflow data and rainfall. A `Poor` classification returns No year-round, since the classification rates the water rather than the season, and only the advisory sign comes down.

## Data sources and licensing

| Country | Endpoint | Auth | Licence |
|---|---|---|---|
| England (EA) | `environment.data.gov.uk/doc/bathing-water/{eubwid}.json` | None | OGL v3 |
| Wales (NRW) | `environment.data.gov.uk/wales/bathing-waters/doc/bathing-water/{eubwid}.json` | None | OGL v3 |
| Scotland (SEPA) | `map.sepa.org.uk/server/rest/services/Open/Environmental_Monitoring/MapServer/1/query` | None | SEPA open data |
| Northern Ireland (DAERA) | `services-eu1.arcgis.com/.../Bathing_Water_Monitoring_Points_Public_View_PRD/FeatureServer/0/query` | None | Crown copyright |
| Storm overflows (9 English + Welsh water companies) | Stream / ArcGIS FeatureServer per company | None | OGL v3 |
| Thames Water CSO | `api.thameswater.co.uk/opendata/v2/discharge/status` | None (open v2 API) | Thames Water open data terms |
| Rainfall and river levels | `environment.data.gov.uk/flood-monitoring/...` | None | OGL v3 |

Attribution is rendered per location page via `src/lib/live/attribution.ts`. Do not strip the attribution lines.

Any regulator the build cannot reach is backfilled per country from the cached index in `scripts/.locations.cache.json`, so the catalogue stays complete rather than shipping a partial deploy. England (EA) and Wales (NRW) share the `environment.data.gov.uk` host, which 403s datacentre IPs, so both fail together on Vercel and are served from cache there. The build only aborts when a regulator fails and the cache holds no rows for its country.

## Map and the verdict precompute

`/map` shows every bathing water on a MapLibre map coloured by today's verdict, plus a "nearest safe beach" list. Pins and list read one precomputed snapshot so they never disagree, and the per-location page stays the live authority on click-through. Code lives in `src/lib/map/`.

- **Colour blob.** A Vercel Cron (`/api/cron/refresh-map`, hourly) computes every beach's verdict and writes `{generatedAt, colours: {id: yes|caution|no}}` to Redis under `map:colours`. The map reads it via `/api/map` (edge-cached `s-maxage=1800`). `computeMapColours` in `src/lib/map/compute.ts` drives it.
- **One verdict engine.** The precompute reuses `deriveVerdict`, extracted from `buildLiveData` in `src/lib/live/verdict.ts`, so the map verdict equals the page verdict from the same inputs. They may differ only by time, never by metric. Keep it that way.
- **Profile cache.** Fetching ~600 EA and NRW profiles at once rate-limits the shared `environment.data.gov.uk` host. An hourly cron (`/api/cron/refresh-profiles`, at :30) refreshes the least-recently-attempted batch into Redis under `map:profiles`, paced (`pacedMap`) under the host's per-minute limit and rotating on attempt time so a persistent block can never starve the rest; coverage converges over a few hours. The colour run reads the cache with a keep-previous-on-failure merge and falls back to the classification for any beach not yet cached, so map coverage is always complete. The colour run's only per-beach call is the discharge feed (ArcGIS, not rate-limited).
- **Rainfall cache.** The hourly colour run batches rainfall for the whole catalogue (`fetchRainfallByLocation`) and writes it to Redis under `map:rainfall`. **The location page reads that blob rather than calling the flood-monitoring host itself.** Resolving the nearest station (`/id/stations?dist=15`) is the slowest call the page can make, measured between 0.1s and 15s, and it was what made a cold location render take ten seconds. Both the map and the page read the blob through `rainfallFrom`, so they can never disagree on the figure. A blob older than `RAINFALL_MAX_AGE_MS` (3h, two cron intervals) is treated as absent, because a stale 24h total drives real cautions. A batch covering less than 40% of the catalogue is discarded rather than written (`hasUsableCoverage`); a healthy run covers about 66%, since only England has stations in range: 462 of 464, against 0 of 114 in Wales, 1 of 90 in Scotland and 0 of 33 in Northern Ireland.
- **Crons need `CRON_SECRET`.** Vercel sends it as a bearer token and the endpoints 401 without it. Either cron can be triggered by hand from the Vercel Cron tab.
- **Basemap.** Grayscale land and coastline come from a self-hosted Protomaps extract at `static/uk.pmtiles`, served at `/uk.pmtiles` (the map's default, override with `PUBLIC_BASEMAP_URL`). Label layers are filtered out so no third-party fonts are fetched. Regenerate with: `pmtiles extract https://build.protomaps.com/<YYYYMMDD>.pmtiles static/uk.pmtiles --bbox=-8.65,49.9,1.77,60.86 --maxzoom=9`.

Runtime env vars (Vercel): `REDIS_URL` (colour, profile, spills and rainfall store), `CRON_SECRET` (cron auth), `PUBLIC_BASEMAP_URL` (optional basemap override).

## Area pages

`/beaches` and `/beaches/[place]` rank the cleanest bathing waters per country and per region (at least five sites), derived entirely from the catalogue (`src/lib/data/places.ts`) so they never carry stale hand-written rankings. A weekly GitHub Action (`.github/workflows/refresh.yml`) pings a Vercel deploy hook (secret `VERCEL_DEPLOY_HOOK`) to rebuild and keep them current.

They are titled "Cleanest beaches in X" rather than the regulator's phrasing, because that is the demand they answer and it is the only demand that survives the winter. Sampling and the daily pollution-risk forecast both stop on 30 September, so classification-led pages carry the site through to May. Keep the share card in `scripts/lib/og-card.mjs` saying the same thing as the title.

`/beaches/rated/[tier]` is the second axis over the same catalogue (`src/lib/data/classifications.ts`): every bathing water at one classification, grouped by country. Four pages only, for the four genuine tiers in `RATED_TIERS`. New, Unknown and Closed are statuses rather than ratings, and Unknown is partly a parser catch-all, so grouping them would assert something the data cannot back.

Two copy rules on those pages are non-obvious and were both got wrong once:

- **Name no actor on Poor.** The duty to display advice against bathing sits with the local authority in England and Wales (Bathing Water Regulations 2013 reg 13(1)(b)), the operator in Northern Ireland (NI 2008 reg 14(b)(ii)) and SEPA itself in Scotland (Scotland 2008 reg 11). "The regulator displays signs" is wrong on three of the four countries the page lists.
- **Classification is "up to" four bathing seasons**, never flatly four. A recently designated site is assessed on fewer.

## URL shape

- `/` homepage, prerendered
- `/swim/[slug]` per-location page, Vercel ISR (5 min revalidation)
- `/map` interactive map plus nearest-safe list, prerendered shell
- `/beaches` and `/beaches/[place]` area hubs, prerendered
- `/beaches/rated/[tier]` classification hubs (`excellent`, `good`, `sufficient`, `poor`), prerendered
- `/near` and `/near/[postcode]` geolocation and postcode results
- `/api/verdict/[id]` JSON endpoint with `s-maxage=300, stale-while-revalidate=600`
- `/api/map` precomputed colour blob, `s-maxage=1800`
- `/api/cron/refresh-map` (hourly, on the hour) and `/api/cron/refresh-profiles` (hourly, at :30), CRON_SECRET-gated
- `/about` prerendered
- `/sitemap.xml` prerendered sitemap index, with `/sitemap-pages.xml`, `/sitemap-swim.xml` and `/sitemap-beaches.xml` as its children
- `/robots.txt`, `/manifest.webmanifest`, `/icon-*.png`, `/og.png`, `/favicon.svg`, `/uk.pmtiles`

## Commands

```sh
pnpm dev                # vite dev server
pnpm build              # build-location-index + generate-images + vite build
pnpm preview            # preview the production build locally
pnpm check              # svelte-check
pnpm test               # vitest run
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
- Don't rename a bathing water anywhere but `scripts/lib/display-names.mjs`, and never let a display name reach `slugify`. Slugs come from the regulator name, so a rename that fed back into slug derivation would move all 700 URLs. The override is keyed by slug and applied after `dedupeSlugs` for exactly that reason.
- Don't add a comment to explain what well-named code already says.
- Don't add backwards-compatibility shims, dead exports or unused vars marked with `_` after a refactor — just delete.

## Known follow-ups

Documented for future sessions, not blocking launch:

1. Thames Water CSO is wired in `src/lib/live/thames.ts` against the open v2 API (`api.thameswater.co.uk/opendata/v2/discharge/status`, no key, no OAuth). The old `client_id`/`client_secret` CloudHub API is retired. Done, no setup needed.
2. Per-location OG share cards rendered at build time via @resvg/resvg-js.
3. Done: postcode and outward-code entry resolve via postcodes.io to the `/near/[postcode]` results page, alongside name search and geolocation (`/near`).
4. Done: the recent-sample trend sparkline (`SampleHistory.svelte`, fed by `src/lib/live/history.ts`) is on the location page. History is fetched live per verdict; it changes only weekly, so it is a candidate to bake in at build time if request cost ever matters.
5. SEPA and DAERA do not expose a per-site daily risk forecast; verdicts for Scotland and NI rely on classification, rainfall and any directly observable CSO data. When those regulators ship a forecast feed, plumb it through `src/lib/live/profile.ts`.
6. The SEPA branch in `build-location-index.mjs` hardcodes `waterType: 'coastal'`, so inland Scottish lochs get coastal sample thresholds and are not skipped by the sea-temperature fetch. They fail safe today (Open-Meteo returns null inland), but a name heuristic (loch, lake, reservoir, river) or a coast-distance check would classify them correctly.
7. `bathingSeasonActive` hardcodes 15 May to 30 September for all four countries. That is the England and Wales default only: Scotland and Northern Ireland set their own dates, and from 15 May 2026 the amended regulations let ministers set site-specific seasons per bathing water. Verify the per-country dates against the regulations before acting, then consider carrying a season on the location record rather than in the engine.
8. **Wales gets no storm-overflow data even though its feed is wired.** `OVERFLOW_ENDPOINTS` in `src/lib/live/discharges.ts` maps Dwr Cymru, but `sewerageUndertaker` is populated only for England in the catalogue: all 114 Welsh, 90 Scottish and 33 Northern Irish rows lack it, so `lookupEndpoint` never resolves and no call is made. Populating the field for Wales in `build-location-index.mjs` would light up CSO alerts for 114 sites. Until then `hasDischargeFeed` keeps the pages honest about it rather than reporting a false all-clear.
9. Per-location or per-area sewage-spill pages are the obvious counter-seasonal inventory, because storm overflows are rain-driven and spill most in autumn and winter, exactly when swimming demand dies. `/spills` is one national page with nothing to rank for. Doing it properly needs spill history in Redis plus a retention policy; without history the pages would be empty most of the time, which is worse than not having them.
