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
│   ├── build-spill-history.mjs     Builds src/data/spill-history.json from the EA EDM returns
│   │                                (manual, once a year, not part of pnpm build)
│   ├── generate-images.mjs         Renders icon.svg / og.svg to PNG variants
│   ├── lib/parsers.mjs             Pure helpers shared with the build script (Vitest-tested)
│   ├── lib/ngr.mjs                 OS National Grid to WGS84 (Vitest-tested)
│   ├── lib/xlsx.mjs                Dependency-free xlsx reader for the EDM returns
│   ├── lib/bathing-water-aliases.mjs  EA spill-return names to our slugs
│   └── lib/display-names.mjs       Slug-keyed overrides for regulator names nobody searches
│
├── src/
│   ├── data/                       Build outputs (do not edit by hand)
│   │   ├── locations.json          701 full records, server-only
│   │   ├── spill-history.json      Five-year EDM spill record, 464 English sites
│   │   └── search-index.json       Slim client-friendly subset (~22 KB gz)
│   │
│   ├── lib/
│   │   ├── data/                   Typed accessors over the JSON (incl. places.ts for area pages)
│   │   ├── verdict/engine.ts       Pure verdict engine. Unit tests cover every branch.
│   │   ├── live/                   Server-side live data fetchers (EA profile, NRW profile,
│   │   │                            SEPA daily prediction, ArcGIS CSO feeds, EA
│   │   │                            flood-monitoring rainfall, Open-Meteo sea temperature
│   │   │                            and tides) and buildLiveData + deriveVerdict.
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

Every England, Wales and Scotland row carries `classificationYear`, and England and Wales also carry `previousClassification` (the season before, fetched in bulk by the build). That is what lets the page say "rated Good in the regulator's 2025 annual classification, down from Excellent the season before" rather than an undated "rated Good". The ratings are republished every November, so an undated claim goes stale on a known date. NI publishes no year.

Bathing season dates are per country, not UK-wide: England and Wales run 15 May to 30 September, Scotland and Northern Ireland 1 June to 15 September. `bathingSeasonActive(date, country)` holds them, and the country reaches the engine through `VerdictInputs.country`. Omitting the country falls back to the England and Wales dates.

**Out of season the closed season is a neutral factor, never a verdict.** It used to push a Caution, which meant every clean site read "Caution. Outside bathing season, the official forecast is not in operation." from 1 October to 15 May. Only about a tenth of the demand behind these pages carries "today"; the rest asks how clean the water is, and that stays answerable from the classification, live storm-overflow data and rainfall. A `Poor` classification returns No year-round, since the classification rates the water rather than the season, and only the advisory sign comes down.

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
| SEPA daily prediction | `map.sepa.org.uk/.../MapServer/18/query` | None | SEPA open data |
| Sea temperature and tide | `marine-api.open-meteo.com/v1/marine` | None | CC-BY 4.0 |

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

## Spill history

Every English location page carries a five-year sewage record built from the Environment Agency's [EDM Storm Overflow Annual Returns](https://www.data.gov.uk/dataset/19f6064d-7356-466f-844e-d20ea10ae9fd/event-duration-monitoring-storm-overflows-annual-returns). It is the one thing on the site a competitor reading the same live feeds cannot reproduce, and it is counter-seasonal: storm overflows are rain-driven, so they spill most in the months swimming demand disappears.

**Generated by hand, not at build time.** The returns are a statutory annual publication due by 1 April, so `pnpm data:spills` is run once a year and `src/data/spill-history.json` is committed. That keeps a 30MB download and a host that 403s datacentre IPs out of the deploy path. The zips cache in `scripts/.edm-cache/` (gitignored).

**Two figures per site per year, and the difference is the point.**

- `attributed` is the overflows the EA itself links to that bathing water in the return's own "Bathing Water(s)" column. It follows the sewer network, so it counts an overflow miles upstream and ignores a nearby one draining elsewhere. **This is the only figure stated as a beach's own record.** 322 of 464 English sites have one.
- `nearby` counts monitored overflows within 10km. Geography, not hydrology, and badly wrong on its own: Henleaze Lake in Bristol collects 267 urban overflows that drain nowhere near it. Offered as labelled context only.

Neither bounds the other. St Annes has 64 attributed overflows against 19 within 10km, because its network runs inland.

**Joining needs no name matching.** Every row carries a full grid reference, converted by `scripts/lib/ngr.mjs` (OSGB36 to WGS84 via Helmert, a few metres, against distances in kilometres). `scripts/lib/bathing-water-aliases.mjs` maps the EA's naming to our slugs where they differ.

**Spill counts only. Do not add durations.** The duration column's unit varies by company sheet rather than by year, the header states the wrong one (every 2021 sheet is titled "(hrs)" except Wessex Water's, whose values are Excel day-serials), and data rows carry stray figures like 4503 and 2019. Reading the unit off the header inflated Wessex 2021 alone from 151,000 hours to 3.6m. The spill column has none of that: bounded at one counted spill a day, highest single value 366 across five years, and national totals within 0.15% of what the EA publishes. Getting hours right needs per-company calibration against each year's summary workbook.

**England only.** The EDM return is an England publication. Dwr Cymru appears but only for its overflows on the English side of the border. Wales, Scotland and Northern Ireland need NRW, SEPA and NI Water equivalents, which is why `getSpillHistory` returns null for those 237 sites and the section does not render.

## Tides and sea temperature

Both come from the Open-Meteo Marine API (open, no key, CC-BY) and both are **server-rendered on the location page**, not fetched after paint. They were client-only, which hid them from crawlers, and cold-water and tide questions are exactly the demand that grows as the water gets colder. The sample-history sparkline is still deferred to `/api/enrichment/[id]`, because it reads the rate-limited regulator sample host that made a cold render take ten seconds.

Neither is an input to the verdict. Both return null for inland sites, which are off the marine grid.

**The tide is modelled and is deliberately not sold as a tide table.** Open-Meteo returns an hourly `sea_level_height_msl` curve, not tide times; `src/lib/live/tides.ts` finds the turning points and refines each with a parabola through the peak sample and its two neighbours.

Validated against EA tide gauges on three coasts in September 2026, the modelled turn ran **20 to 60 minutes ahead** of the observed one (Newhaven 28 min, Plymouth 34 to 63 min, Kinlochbervie 19 to 34 min). Some of that is real, because the grid cell is offshore and a harbour lags the open coast, but most of it is model error. So:

- Times are rounded to ten minutes (`roundToTenMinutes`) and printed as "about 17:30", because minute precision would claim an accuracy the data does not have.
- The section is headed "Tide", not "Tide times", and leads with rising or falling, which is the part that survives the error and the part a swimmer actually wants.
- The component states the half-hour caveat and links to Admiralty EasyTide. **Do not remove either.** UKHO is the authority, but its APIs need a registered key and its predictions cannot be republished.

If tide times ever need to be accurate, that means a UKHO Admiralty licence, not a better parser.

## Sewage league tables

`/beaches/sewage` and `/beaches/sewage/[place]` rank English bathing waters by storm-overflow spills, from the same five-year EDM record the location pages carry. `src/lib/data/spill-league.ts` derives them, so they never carry a hand-written ranking. 24 prerendered pages: the hub carries the whole national table, plus 23 English regions.

**There is deliberately no `/beaches/sewage/england`.** It would ship the same rows and the same title as the hub and compete with it, so `getSpillLeaguePlaces()` returns regions only. An English location whose hub is the country page links to `/beaches/sewage` instead.

This is the counter-seasonal asset. Storm overflows are rain-driven, so they spill hardest from October to March, exactly when swimming demand disappears, and the EA republishes the return every April.

Three rules the tables must keep:

- **Rank on `attributed`, never on `nearby`.** `attributed` is the set of overflows the EA itself links to that bathing water, so it follows the sewer network. `nearby` is a 10km radius, which is geography rather than hydrology and puts 267 urban overflows against a lake in Bristol they do not drain into. A table headed "worst for sewage" has to be defensible row by row.
- **A site with no attributed record is left out, not ranked at zero.** No record is not a clean record, and the pages say how many are missing.
- **Every row is the same year.** The ranked year is the newest any site has a comparable figure for. A site whose record stops earlier drops out rather than being carried in on an older figure. The per-row trend baseline varies by site, so it is printed with the row ("since 2022"), because a year too patchily monitored to compare is dropped from that site's record.

`ranked` and `withRecord` are different numbers and both are stated: 464 English bathing waters, **324** carry an attributed record, **300** have a comparable 2025 figure to be ranked on. Conflating them once told readers that a site whose record stops at 2023 had no record at all.

## URL shape

- `/` homepage, prerendered
- `/swim/[slug]` per-location page, Vercel ISR (5 min revalidation)
- `/map` interactive map plus nearest-safe list, prerendered shell
- `/beaches` and `/beaches/[place]` area hubs, prerendered
- `/beaches/rated/[tier]` classification hubs (`excellent`, `good`, `sufficient`, `poor`), prerendered
- `/beaches/sewage` and `/beaches/sewage/[place]` sewage league tables, England only, prerendered
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
pnpm data:spills        # rebuild the EDM spill history (run once a year, after 1 April)
pnpm data:images        # regenerate PNG icons and OG card
```

## Don't

- Don't introduce Tailwind, ESLint, Prettier, CSS-in-JS or a UI component library.
- Don't break the copy rules above. They are the most common source of regressions.
- Don't add features beyond what's asked, refactor adjacent systems as a side effect, or "clean up" code you don't fully understand. Surgical changes only.
- Don't write planning, decision or analysis Markdown files unless explicitly asked.
- Don't strip data-source attribution lines.
- Don't state coverage from a template condition. `coverageNotice` in `src/lib/live/coverage.ts` returns one value for what the page may claim about live data, because two independent branches once contradicted each other: the Scottish notice said "none is showing for this site right now" on a gate that was true for every Scottish site, so it would have denied a SEPA forecast at the moment one arrived and drove the verdict above it.
- Don't rank anything on the `nearby` spill figure. It is a 10km radius, not the sewer network, and it is offered as labelled context only. Only `attributed` may be stated or ranked as a beach's own record.
- Don't present the tide as authoritative or navigational, and don't drop the EasyTide link. It is a model, not an Admiralty prediction.
- Don't rename a bathing water anywhere but `scripts/lib/display-names.mjs`, and never let a display name reach `slugify`. Slugs come from the regulator name, so a rename that fed back into slug derivation would move all 700 URLs. The override is keyed by slug and applied after `dedupeSlugs` for exactly that reason.
- Don't add a comment to explain what well-named code already says.
- Don't add backwards-compatibility shims, dead exports or unused vars marked with `_` after a refactor — just delete.

## Known follow-ups

Documented for future sessions, not blocking launch:

1. Thames Water CSO is wired in `src/lib/live/thames.ts` against the open v2 API (`api.thameswater.co.uk/opendata/v2/discharge/status`, no key, no OAuth). The old `client_id`/`client_secret` CloudHub API is retired. Done, no setup needed.
2. Per-location OG share cards rendered at build time via @resvg/resvg-js.
3. Done: postcode and outward-code entry resolve via postcodes.io to the `/near/[postcode]` results page, alongside name search and geolocation (`/near`).
4. Done: the recent-sample trend sparkline (`SampleHistory.svelte`, fed by `src/lib/live/history.ts`) is on the location page. History is fetched live per verdict; it changes only weekly, so it is a candidate to bake in at build time if request cost ever matters.
5. Done for Scotland, outstanding for NI. SEPA does publish a daily pollution-risk prediction, for the ~33 sites carrying an electronic sign, on layer 18 of the MapServer the catalogue is already built from. `src/lib/live/sepa.ts` reads it and `fetchProfile` folds it in. **It is gated on freshness and currently shows nothing**: every row in the open-data layer has carried a `last_updated` of 19 May 2026 all season, even though SEPA's own site updates daily by 10:00, and serving a four-month-old "Poor" as today's forecast is worse than showing none. If SEPA resumes updating the mirror, Scottish forecasts light up with no code change. DAERA still exposes no forecast.
6. The SEPA branch in `build-location-index.mjs` hardcodes `waterType: 'coastal'`, so inland Scottish lochs get coastal sample thresholds and are not skipped by the sea-temperature fetch. They fail safe today (Open-Meteo returns null inland), but a name heuristic (loch, lake, reservoir, river) or a coast-distance check would classify them correctly.
7. Done. `bathingSeasonActive(date, country)` now carries the real dates: England and Wales 15 May to 30 September (Bathing Water Regulations 2013), Scotland and Northern Ireland 1 June to 15 September (SSI 2008/170 and the NI 2008 regulations). The old England-for-everyone default was wrong for 123 sites at both ends of the season, 32 days a year. Still outstanding: from 15 May 2026 the amended English regulations let ministers set a site-specific season per bathing water. No regulator feed publishes one per site yet; when one does, it belongs on the location record rather than in the engine.
8. Done. **Wales now has live storm-overflow data on all 114 sites.** Two things were broken, not one. The mapped Dwr Cymru endpoint was dead (`DCWW_Storm_Overflow_Activity` returned "Invalid URL"); the live service behind Welsh Water's own public map is `Spill_Prod__view` on the same ArcGIS org. And `sewerageUndertaker` was never populated for Wales, so `lookupEndpoint` never resolved. The build now sets `Dwr Cymru Cyfyngedig` on Welsh rows, which is the key the lookup table already held.

   Two things about that feed differ from the English ones and both are load-bearing:
   - **Status is a phrase, not a 0/1 flag.** `isDischarging` in `discharges.ts` tests the negative forms first, because `Overflow Not Operating (Has in the last 24 hours)` contains the word "Operating" and a substring match would report a finished spill as running, which is a hard No on the beach page.
   - **Timestamps are naive UK local time.** `2026-09-04T11:02:34` means 11:02 BST. `Date.parse` reads that in the host's zone, which is UTC on Vercel, putting every summer event an hour into the future. `parseLondonNaive` in `src/lib/util/time.ts` handles it, and `parseDate` in `discharges.ts` routes every string feed through it: a string carrying its own offset is left alone.

   Scotland (90) and Northern Ireland (33) still have no CSO feed, so `hasDischargeFeed` still keeps those pages honest.
9. Done. `/beaches/sewage` and `/beaches/sewage/[place]` are the league tables, built by `src/lib/data/spill-league.ts` over the same catalogue and spill record: England plus 23 English regions with at least five ranked sites. See **Sewage league tables** above for the rules they follow.
10. Welsh, Scottish and Northern Irish **spill history** still has no usable source, so 237 sites carry no five-year record. This was investigated properly in September 2026 and is blocked rather than merely unstarted:
   - **NRW** publishes storm overflow spill data reports as **PDFs only**, 2022 to 2024, with no 2025 and no grid references. Not machine-readable and not joinable to a bathing water.
   - **Welsh Water** publishes EDM data on its own site, but as a map rather than an annual return with coordinates.
   - The Rivers Trust republishes an England-and-Wales EDM FeatureServer with coordinates, but only to 2022, and it is third-party republication rather than the regulator's own return.

   Note this is spill *history* only. Wales now has live CSO data (follow-up 8), which is the part that matters for today's verdict.
