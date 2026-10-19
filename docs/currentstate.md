# Current State

As of 2026-10-14 21:45 IST, branch fix/autofill-sdk-key (Phase 1 milestone M0, platform admin, the UI redesign and the freeabtest.com landing page). Usable for local development and
a single-instance deployment. Not yet a full MVP: the SDK, targeting, goals and results UI are still the old prototype.

## Stack
- Next.js 16 App Router, React 19, TypeScript (strict), Tailwind 4 with an in-house component set (`app/components/ui`). Inter and JetBrains Mono via next/font. DaisyUI removed.
- Auth: next-auth v4 with Google. Users get an organization, a default project and dev, staging and prod environments on first sign-in.
- Database: SQLite through libSQL (`@libsql/client`) and Drizzle ORM. Local file `data/cro.db` by default, Turso in production.
  Schema in `lib/db/schema.ts`, SQL migrations in `drizzle/`, applied automatically on first request (turn off with `DB_AUTO_MIGRATE=false`) or with `npm run db:migrate`. Drizzle only applies a migration whose journal `when` is greater than the newest applied one, so new entries must use a timestamp above every earlier entry (enforced by tests/migrations.test.ts).
- Validation: Zod (`lib/validation.ts`).
- Tests: Vitest, 67 tests in `tests/` (bucketing, statistics against scipy reference values, API keys, rate limiter, database layer, API routes, platform admin authz, suspension and quotas).
- CI: GitHub Actions (`.github/workflows/ci.yml`) runs lint, typecheck, tests and build on pushes to main and on pull requests.

## Data model
users, organizations (with status, suspended_at, suspended_reason, plan, monthly_visitor_limit, monthly_experiment_limit), memberships (owner or member), projects, environments (dev, staging, prod), api_keys,
experiments (belong to a project, owned by a user), variations, assignments, events (tagged with environment), audit_log.

## UI
- Light, neutral B2B design with a blue primary and teal secondary accent (green kept for status only), branded freeabtest.com (leaf logo). The landing page matches the homepage mockup section by section and contains only: nav, hero with an example-data dashboard mock and handwritten annotation, "Works with your stack" row (only JavaScript and HTML available, the rest marked soon), How it works, Test anything with the layered illustration, a stats strip of verified facts, and a footer. Pricing plus FAQ live at /pricing, features and roadmap at /roadmap. Shared marketing header and footer in app/components/landing/SiteChrome.tsx.
- Vercel Analytics on every page via root layout (`@vercel/analytics`).
- Browser SDK: readable source in `sdk-src/sdk.js`, built/obfuscated to `public/sdk.js` via `npm run sdk:build` (hooked into `npm run build`).
- Platform telemetry (super-admin /admin/telemetry only): usage volume per user/org/project/experiment, DAU/WAU/MAU, SDK event counters, quota %, CSV export. Aggregated daily rows; no visitor PII (IPs hashed).
- URL split tests: register domains per project, wizard to create control + variation URLs and CSS click goals, one-line SDK install, flicker-free redirect, per-goal results. Free plan: 1 variation; paid: up to 10.
- In-product documentation at /docs (12 customer-facing pages: introduction, quick start, SDK, experiments, variations, goals, results, choosing a winner, REST API, environments and keys, organizations and projects, troubleshooting and FAQ). Public pages never mention internals (stack, database, hosting, env vars, rate limiter, repo, admin console); tests/publicContent.test.ts enforces this. Setup and admin knowledge stays in README and docs/*.md. Content is data in lib/docs/content/*.ts, rendered by app/docs with a sidebar, on-page TOC, client-side search, copyable code, callouts and SVG diagrams. Linked from the site nav (Resources), footer and app sidebar. Planned features are marked Coming later. tests/docs.test.ts checks links, headings, no em dashes and limits against the code. See the UI conventions in `docs/agent.md`.
- Marketing page `/`: hero with an example results card (labelled example data), features available today, how it works with the SDK snippet,
  public roadmap by phase, pricing placeholder (clearly marked, no prices), FAQ, footer.
- Sign-in page `/signin` (Google). next-auth uses it as its sign-in page.
- App shell for signed-in pages (`app/(app)/layout.tsx`): sidebar (Overview, Experiments, API keys, Admin console for platform admins),
  top bar with org and project switcher and account menu, mobile drawer. Signed-out visitors are redirected to `/signin`; suspended tenants see a suspended page.
- Project switcher stores the selection in the `cro_project` cookie. Overview and Experiments show that project, and new experiments are created in it.
- Overview `/dashboard`: status counts, visitors this month, get-started checklist, recent experiments.
- Experiments `/experiments`: table with status tabs. `/experiments/new`: create form with weights that always total 100.
- Experiment page `/experiments/[id]`: start, pause, resume, complete and delete actions; Results tab (summary, table with lift and intervals,
  confidence interval chart), Setup tab (variations and install snippet), Settings tab (edit name, description and traffic allocation).
- API keys `/settings/keys` and the admin console `/admin` use the same shell and components.

## Features that work
- Google sign-in with automatic workspace setup.
- Experiments: create with weighted A/B/n variations and traffic allocation, start, pause, complete, delete drafts.
  Status transitions are enforced. Only members of the experiment's project can read or change it.
- API keys: page at `/settings/keys` to create and revoke SDK keys (`cro_pk_<env>_...`) and secret keys (`cro_sk_<env>_...`) per environment.
  Only SHA-256 hashes are stored; the key is shown once. Last used time is tracked.
- `POST /api/assign` and `POST /api/track` require an SDK key in `X-API-Key`, reject secret keys, only see experiments in the key's project,
  record the environment, and are rate limited per key and client IP (default 600 per minute, `RATE_LIMIT_PER_MINUTE`). CORS preflight is supported.
- Management API (`/api/experiments...`) accepts a session or `Authorization: Bearer cro_sk_...` for reads. Creating experiments needs a session.
- Results: conversion rate per variation, Wilson confidence intervals, two-proportion z-test, optional `?environment=dev|staging|prod` filter.
  Conversions count unique converting visitors, so rates cannot exceed 100%.
- Audit log entries for org creation, experiment create, update, status change and delete, and key create and revoke.
- Platform admin: super-admins are listed in `PLATFORM_ADMIN_EMAILS` (separate from org roles; secret keys never grant it).
  `/admin` (server-side guarded, 404 for everyone else) lists all tenants with members, projects, experiment and running counts,
  visitors and events this month, limits and created date. `/admin/orgs/[id]` shows details and the tenant audit log and lets the admin
  suspend or reactivate the tenant and edit plan name and monthly visitor and experiment limits. API: `GET /api/admin/orgs`, `GET` and `PATCH /api/admin/orgs/[id]`.
  Every admin change is audited as `admin:suspend`, `admin:reactivate` or `admin:update` with before and after values.
- Suspension: SDK keys of a suspended tenant get 403 on assign and track, secret keys get 403, and the dashboard and management APIs return 403 or show a suspended page. Data is kept.
- Quotas (basic, calendar month UTC, null = unlimited): past the visitor limit, new visitors get `assigned: false, reason: "quota_exceeded"` while already enrolled visitors keep their variant.
  Past the experiment limit, starting a new experiment returns 403 (resuming paused ones is allowed). No billing.
- Browser SDK `public/sdk.js` (needs `apiKey` in `ABTest.init`). The duplicate `public/ab-sdk.js` was removed.

- Live stats on the experiment Results tab (auto-refresh every 30 s while running): total visitors, visitors and share per variation,
  visitors redirected from the control URL to each variation URL (recorded server side as a `redirect` event at bootstrap), page views,
  goal clicks per CSS-selector goal by variation ranked by clicks, conversion rate with Wilson 95% interval, relative uplift vs control
  with a 95% interval (Newcombe score method), status per goal and overall ("Variation 1 is ahead", "Control is ahead", "Too early to call";
  significance needs 100+ visitors per arm and p < 0.05), daily unique visitors chart (UTC). Empty state before the first visitor.
  Experiments list shows visitors, goal clicks and the result so far. Logic in `lib/liveStats.ts`, counts in `db.getLiveCounts`.

## Fixes in this milestone
- Removed the `?userId=` query parameter that let anyone list another user's experiments.
- Experiment detail, update, delete and results endpoints had no auth. They now require access to the project.
- Sample size estimate used z = 1.96 for 80% power (should be 0.84), roughly doubling the estimate. Now uses an exact inverse normal.
- Confidence levels other than 90, 95 and 99% silently fell back to 95%. Any level now works.
- Variation URLs from the create form were dropped. They are now stored.

## Known gaps
- Rate limiter is in memory per instance. On Vercel with many instances it needs a shared store (Upstash Redis) to be strict.
- CORS allows any origin. Per-project domain allowlists come in M2 with the new ingest endpoint.
- SDK still makes a server call per visitor, has no anti-flicker, no batching or retries. Rebuilt in M1.
- No targeting, goal definitions, revenue metrics, SRM check, sample size page or CSV export (M1 to M3).
- Audit log is visible only to platform admins. No org or member management UI for tenants, org roles are owner or member only.
- Quota checks run a count query per new visitor. Cache usage or move it to the rollup job before heavy traffic.
- Platform admin is env-based only: no admin UI to grant it, and no impersonation (not planned).
- Not a monorepo yet; no Playwright tests yet.

## Next
`docs/roadmap.md`, Phase 1 milestone M1 (core bucketing package, targeting, datafile, new SDK).

## Goals, targeting and test management (Oct 2026)
- Goal types (lib/goals.ts): click and form (CSS selector, bound in the SDK), page visit (equals / contains / regex) and custom event (`ABTest.track('name')` -> POST /api/sdk/event). Page and event goals are matched server side in lib/goalHits.ts for visitors with an assignment; one conversion per visitor per goal. Public roadmap /roadmap shows five phases at a high level only. Internal scaling notes: docs/scaling.md.
- Targeting (lib/targeting.ts): devices, UTM source/medium/campaign, referrer contains, new vs returning. JSON in experiments.targeting, checked in bootstrap for new visitors only (reason not_targeted).
- Edit running tests (Edit test tab, app/(app)/experiments/[id]/EditTest.tsx): weights and pause via PATCH /api/experiments/[id]/variations (lib/allocation.ts), add goal via POST /api/experiments/[id]/goals, audience via PATCH targeting. variations.paused (0007) excluded from new assignments.
- SRM: sampleRatioMismatch in lib/statistics.ts, srm field in results (lib/results.ts buildExperimentResults), warning component app/components/SrmWarning.tsx.
- Share links: share_links table (0008), /api/experiments/[id]/share (GET/POST/DELETE), public page app/share/[token] using lib/shareView.ts. Covered by publicContent tests.
- Install guides doc page (lib/docs/content/installGuides.ts): GTM and WordPress.
- Pageview quotas (lib/pageviewQuota.ts): usage_monthly counter + organizations.monthly_pageview_limit (0009). Free 25k, paid 500k (lib/plans.ts). Paused at cap (bootstrap reason quota_paused; track/event 202 paused). Platform admin members unlimited. Overview usage card (app/components/PageviewUsage.tsx), admin cap field.

## Scaling fixes (2026-10-15)
- Config cache: `lib/configCache.ts`, 45 s TTL per instance for key lookups, domain hosts, running test config and track config. Any write through `lib/db` clears the instance cache; other instances refresh within the TTL (so a revoked key can work for up to 45 s on other instances).
- Visitor quota: `usage_monthly.visitors` counter plus `org_visitors_monthly` (org, month, visitor) first-seen rows, backfilled from assignments in migration 0010. `checkVisitorQuota` reads one row, cached 10 s.
- Results: `lib/rollups.ts`. `experiment_stats_daily` holds closed UTC days per scope (env id or *) and bucket (v any event, t:type, g:goal, d daily distinct). Visitors count on their first-seen day, so sums equal raw distinct counts. `rollup_state` tracks the last closed day. Rollups run lazily on read (this is also the backfill). Raw reference queries remain as `db.getEventStatsRaw` and `db.getLiveCountsRaw`; tests assert equality. Caveat: deleting a goal after its days are rolled up keeps the old goal rows in history.
- Telemetry: `bumpMetric` buffers and flushes in one batch via Next.js `after()` (timer fallback). `TELEMETRY_SYNC=1` writes immediately (tests).
- SDK: events queued, page views sent within 1 s, conversions immediately, rest via sendBeacon (text/plain, key in query) on page hide. `/api/track` accepts `{ events: [...] }` (max 50) and inserts in one statement.

## Entitlements (2026-10-15)
- `lib/entitlements.ts`: `computeEntitlements` (pure), `getOrgEntitlements` (30 s cache), `canUseFeature`. HEAVY_FEATURES = heatmaps, recordings, raw_capture; add every future heavy or raw-capture feature there. Rule: plan != free, or an org member who is a platform admin or imrn.dev@gmail.com (unlimited, no caps).
- Enforced on the server: bootstrap includes `capture` only for entitled orgs, `/api/capture` returns 403 otherwise. `/api/plan` returns `features` for the UI. Free plans see an upgrade note on the experiment Heatmaps tab.

## Special friends (2026-10-15)
- `organizations.special_friend` and `custom_allowances` (JSON, `lib/allowances.ts` zod schema, migration 0011). Admin only: PUT `/api/admin/orgs/[id]/allowances`, panel on /admin/orgs/[id], badge and `?filter=special` on /admin. Audited as `admin:special_friend` with before and after.
- Precedence in `computeEntitlements`: admin member (everything, no caps) > special friend allowance (each set field) > plan. Pageview cap, visitor quota and max variations now come from `limits`. Active experiments, projects and seats are stored and exposed in `limits`; enforcement for them lands with the free-tier limits. `flags` is reserved for future feature flags.

## Free tier limits (2026-10-15)
- Defaults in `lib/plans.ts`, effective values only from `getOrgEntitlements().limits`: monthlyVisitors 10,000, dailyVisitors 300, activeExperiments 1, lifetimeExperiments 10, projects 1, maxVariations 1 for free; paid: maxVariations 50, others unlimited (pageviews 500,000). Free pageview cap removed.
- Visitors: `usage_daily` counter (migration 0012) bumped with the monthly first-seen row. `checkVisitorQuota(org, user)` lets visitors already counted this month through.
- Experiments: `checkExperimentStartQuota(org, firstStart)` in PATCH /api/experiments/[id]: running limit on every start/resume, lifetime and monthly limits on first start. Create is refused once the lifetime limit is used. `experiments_started_total` increments on first start and never decreases.
- Projects: limit exposed (1 on free); there is no project-create API yet, so nothing else to enforce.
- Overview: `app/components/PlanUsage.tsx`. Errors from the API use `quotaMessage`.
## Blog (2026-10-15)

- File-based markdown blog. Posts live in content/blog/*.md; adding a post only needs a new .md file (slug from frontmatter, else filename).
- lib/blog.ts parses frontmatter, renders markdown with marked and sanitizes it with sanitize-html (no scripts, event handlers or javascript: links). JSON-LD from article_schema and faq_schema is parsed, re-serialised and escaped before injection.
- Routes: /blog (index, newest first), /blog/[slug] (static, dynamicParams off), /blog/rss.xml (static RSS), /sitemap.xml (core pages plus posts).
- Optional `category` frontmatter; if missing it is derived from keywords (Tools, Statistics) or defaults to Guides. FAQ section ("## Frequently asked questions", **Question?** then answer) renders as an accordion; tests check it matches faq_schema.
- Posts are dated from frontmatter; a post with a future date still publishes on deploy (no scheduling).
- tests/publicContent.test.ts checks blog frontmatter, sort order, JSON-LD validity, sanitizing, internal terms and em dashes.

## Public copy rules (2026-10-15)
- tests/publicCopyMatchesApp.test.ts checks pricing, cards, docs and homepage numbers against lib/plans.ts, bans old variant counts and Bayesian/sequential promises, and requires every pricing Coming soon phase tag to point at a roadmap phase that is not Done.

## Free-tier domain rules
- Free orgs (not paid, not special friends, not admins) get 1 registered domain; localhost does not count. Special friends can override via allowances.domains.
- Global ledger domain_ledger keyed on eTLD+1 (tldts, public suffix list). First free claim wins; removing a domain releases the claim but keeps experiments_used.
- A first start of a free test on a domain whose ledger count is 10 is refused; a domain with 10 used tests cannot be added by another free org.
- bootstrap, assign, track, sdk/event and capture require Origin or Referer on a registered domain; development keys also accept localhost. Missing headers are refused.
- Abuse attempts are audited as abuse:* (origin logs throttled per org and host hourly) and listed with the ledger at /admin/abuse.
- No backfill: tests started before this change are not on the ledger.

## Install once copy
- lib/installCopy.ts INSTALL_ONCE is shown under every InstallSnippet (dashboard, domains, new test wizard, experiment page) and in Quick start and Install guides.

## Profile onboarding
- users gains first_name, last_name, country (ISO 3166), phone (E.164 via libphonenumber-js), company, job_role, company_size, heard_from, primary_goal, marketing_opt_in (default false), profile_completed_at, onboarding_pending, profile_prompt_dismissed_at (migration 0014).
- New Google sign-ups get first and last name prefilled and onboarding_pending; the (app) layout redirects them to /onboarding until they save or skip. Existing users see a dismissable banner.
- lib/profile.ts: zod schema (strips markup and control characters, select whitelists), safeNext for return paths, CSV cells guarded against formula injection.
- lib/profileGate.ts: POST /api/experiments and PATCH to running return 403 profile_incomplete until first name, last name and country are set. Platform admins and the super admin are exempt; secret-key calls pass when an org member has a completed profile.
- /settings/profile (sidebar Profile), /api/profile GET/PUT, /api/profile/skip, /api/profile/dismiss. Admin org page shows member profiles; /api/admin/profiles exports CSV.
- tests/setup.ts gives test users a completed profile by default (pass first_name: null for none).

## WordPress plugin
- Source in integrations/wordpress/freeabtest (not in /public). Zipped on request by GET /api/downloads/wordpress for signed-in users; signed-out get 303 to /wordpress?download=signin#download.
- One autoloaded option freeabtest_settings; front end only calls get_option and wp_print_script_tag at wp_head priority 1. Keys must match ^cro_pk_(prod|dev)_[0-9A-Za-z]{32}$. SDK URL hardcoded.
- Connect link: https://<domain>/wp-admin/options-general.php?page=freeabtest&freeabtest_prod=<key> only prefills; saving needs the settings nonce and manage_options.
- PHPCS (WordPress-Extra, WordPress.Security, WordPress-Docs, PHPCompatibilityWP 7.4-8.3): 0 errors, 0 warnings. Plugin Check 2.1.0 on WP 7.1.3: no errors or warnings. CI runs PHPCS.

## Heatmaps
- Bootstrap returns capture {heatmaps, sample_rate} only for orgs with the heatmaps entitlement, on matched pages where the visitor stays. Sampling is a deterministic hash of visitor and experiment (HEATMAP_SAMPLE_RATE, default 0.5).
- public/heatmap.js (loaded by the SDK only when heatmaps is true) sends click {x 0-1000 of page width, y px, selector, rage, dead} and one max scroll depth per page view. No keyboard listeners, no values or text. Batches of up to 50 every 10 s, beacon on hide.
- POST /api/capture: plan check (403 for free), origin check, strict zod schema (unknown fields rejected), running experiment and known variation. Rollups heatmap_clicks_daily (2% columns x 25 px rows x selector) and heatmap_scroll_daily, aggregated per batch; heatmap_points raw kept 30 days (pruned on about 2% of ingests).
- GET /api/experiments/:id/heatmaps?variation=&device= (paid only) feeds the Heatmaps tab: click map, scroll map, confetti, overlay (sandboxed iframe) and element list. Migration 0015.

## In-app links to public pages
- Links from the signed-in app to /docs, /pricing, /roadmap, /blog or /wordpress use target=_blank and rel=noopener noreferrer (tests/inAppLinks.test.ts).

## App dark mode
- lib/theme.ts themeInitScript runs in the root layout head and sets html[data-theme] from localStorage fabt-theme (light, dark or system via prefers-color-scheme).
- Only .app-scope (AppShell, so app and admin, plus onboarding) reacts: globals.css remaps the zinc and tint palette variables and fixes white surfaces, dark chips and links. Marketing pages have no .app-scope and stay light.
- ThemeToggle (top bar) uses useSyncExternalStore with a system default on the server, so there is no hydration mismatch. Chart grid and labels use theme classes.

Goals: up to 50 per experiment, each with a name and one CSS selector (css-what parse, single selector group) or a page or event target. goals.position (migration 0016, backfilled primary first then by created_at) sets order. POST/PATCH(order|primary)/DELETE on /api/experiments/[id]/goals, all audited; the last goal cannot be removed and removing the primary promotes the first remaining goal. Results read all goal stats from one rollup pass (getEventStatsByGoal). SDK bindGoals pre-splits click/form goals and drops a goal once it fires. Legacy comma-list selectors stay valid in the SDK.

Blog: redesigned index and post layout (PR #34) merged with main; blog styles are light only and sit outside .app-scope, so app dark mode does not touch them. BlogPosting JSON-LD fallback from frontmatter kept.

Blog: 2 posts (best-free-ab-testing-tools, how-long-to-run-an-ab-test). Article and FAQ JSON-LD come from frontmatter and render as script tags in the post page.

Copy consistency: significance wording follows lib/results.ts (best variant vs control) and lib/liveStats.ts (each variant vs control); weights are editable on draft, running and paused tests (lib/allocation.ts). Guarded by tests/copyConsistency.test.ts.

WordPress plugin (paid only, 1.1.0): entitlement feature wordpress_plugin (paid plans, special friend allowance wordpress_plugin, platform admins). GET /api/downloads/wordpress checks the session every time, picks the first entitled org (lib/pluginDownload.ts), limits 10 per user per hour and 30 per org per day (counted in plugin_downloads, migration 0017), logs org/user/version/ip hash, and adds freeabtest/license.txt with org id and download id. POST /api/plugin/verify (lib/pluginLicense.ts, 30/min per IP) returns ok, invalid_key, suspended, not_paid, no_domains or domain_not_allowed; the plugin stores the answer in freeabtest_status per key hash and prints the snippet only while ok (kept through outages, recheck every 12h via wp-cron and on admin page view). The snippet carries data-via=wp; the SDK and heatmap.js add via=wp to every call and checkSdkOrigin refuses plugin traffic from orgs without the feature (abuse:plugin_unpaid). Admin: /admin/downloads, special friend toggle. Note: the plugin source is in the public repo, so protection rests on the server checks.

Funnels (paid, feature 'funnels', special friend allowance): table funnels (migration 0018, steps = JSON goal ids). GET/POST/DELETE /api/experiments/[id]/funnels (403 with upgrade note for free). Numbers come from one grouped query over raw conversion events (first time per visitor, variation and goal, db.getFirstGoalHits) plus rollup visitors; lib/funnels.ts computeFunnel counts a step when its first completion is at or after the previous step's. Steps whose goal was removed are dropped and reported. Scale note: the hits query is bounded by converters times steps; add a rollup if it gets slow.

SDK size claim: public copy says under 30 KB gzipped, about 100 KB raw; tests/sdkSizeClaim.test.ts keeps public/sdk.js under 28 KB at gzip level 6 and under 115 KB raw. The obfuscation build (dead code injection 0.4) is most of the size. Later: SDK slimming (lower dead code injection or split modules) to get back toward 15 KB.

Revenue goals (paid, feature 'revenue_goals', special friend allowance): events.revenue real column (migration 0019). POST /api/sdk/event accepts revenue (0 to 1,000,000, rounded to 2 decimals); lib/goalHits.ts keeps it only when the org has the feature, records every order for event goals (cap 50 revenue events per visitor and goal), and bumps the conversions metric only on the first conversion, so rollup conversion counts stay once per visitor. GET /api/experiments/[id]/revenue (403 with upgrade note for free) runs one grouped query over raw conversion events (db.getRevenueStats: buyers, orders, sum, sum of squared per-visitor totals) plus rollup visitors; lib/revenue.ts computes revenue per visitor (non-buyers count as 0), average order, lift and Welch's t-test (normal approximation, verdict after 30 visitors in both arms). Amounts carry no currency; the UI says they are in the site's currency.

Auto-shift (feature 'auto_shift', GROWTH_FEATURES: Growth and Enterprise via lib/plans.ts planTier; special friend allowance; admins): experiments.auto_shift and auto_shift_at (migration 0020). GET/PATCH /api/experiments/[id]/auto-shift (403 with upgrade note below Growth). lib/autoShift.ts: seeded Beta posterior sampling (4,000 draws), floor min(10, floor(50/n))%, whole weights summing to 100, waits for 100 visitors per active arm. lib/autoShiftRun.ts maybeAutoShift: per-instance 5 minute memo, atomic claim (UPDATE where auto_shift_at older than 1 hour and status running), entitlement re-check (downgrade stops shifting), rewrites weights via updateVariationAllocation, audit 'allocation:auto' with weights and probabilities. Scheduled with after() from /api/sdk/bootstrap and /api/assign (no cron). The SRM warning is skipped while auto-shift is on; results show a note. Recordings postponed (needs object storage), see docs/roadmap.md.

Blog post 01 copied byte for byte from the ABTest Content store (line 78 SDK size fix); tests/sdkSizeClaim.test.ts now also checks it.

Traffic overview (paid, feature 'traffic', special friend allowance, admins): table traffic_daily (migration 0021; PK day, environment_id, dim, key). The SDK bootstrap adds one page view for entitled orgs via lib/telemetry.ts bumpTraffic: counters merge in the same in-memory buffer flush as telemetry and are upserted in the same db.batch as telemetry_daily, so a page view adds no extra round trip (bootstrap already flushes the sdk_bootstrap counter). No sampling. lib/traffic.ts trafficDimensions: views, page (path, 200 chars), new_views (SDK visitor=new, per session), device (user agent), country (x-vercel-ip-country), entries and source (utm_source, else referrer host without www, else direct; internal referrers are not entries). GET /api/traffic?days=7|30|90&environment=prod (current project cookie, 403 with upgrade note for free). Free orgs record nothing. Scale note: page keys are unbounded per day; add a per-day cap if a site has very many distinct paths.

Heatmap compare: client side only (HeatmapsPanel CompareView), two requests to the existing GET /api/experiments/[id]/heatmaps (paid gate unchanged). Shared max and row count across both sides; list view merges selectors with clicks and share per side. tests/heatmapCompare.test.ts renders CompareView with react-dom/server.

Heatmap JSON export: GET /api/experiments/[id]/heatmaps/export?device=&variation= (paid, same heatmaps gate). Attachment with schema freeabtest.heatmaps.v1, exported_at, experiment, device, period_days, fields (EXPORT_FIELDS), variations[] each with the heatmapReport payload. Max 20 variations per file (truncated note), audit 'heatmap:export', Cache-Control no-store. tests/heatmapExport.test.ts.

GA4 push: sdk-src/sdk.js analyticsPush, called in the bootstrap path for assigned visitors only (not redirect or guard). gtag('event','experience_impression', params) when window.gtag exists, else dataLayer.push({event, ...params}) when window.dataLayer exists; never creates globals; try/catch. Params: exp_variant_string FABT-<exp>-<var>, experiment_id, variation_id, variation_name, is_control. No test names. SDK build is now 107.6 KB raw, 28.4 KB at gzip 6 (claim stays under 30 KB; headroom is small, see SDK slimming).

Traffic page cap: TRAFFIC_MAX_PAGES_PER_DAY 500 and OTHER_PAGES '(other)' in lib/traffic.ts. Enforced in db.bumpTelemetryBatch via cappedPageUpsert: two raw statements per buffered page row inside the same batch (INSERT ... SELECT WHERE key exists OR distinct page keys that day < 500, then roll into '(other)' WHERE the key row still does not exist). No extra round trip; correct across instances because the check runs in the database. Traffic page labels '(other)' as Other pages with a hint.

Visual editor: variations.changes JSON (0022, when 1791972300000); variations without url are visual (create route allows a missing url on non-control variations, Growth+ via entitlement visual_editor in GROWTH_FEATURES, special friend toggle). lib/visualChanges.ts (zod: text, hide, style allowlist, attr allowlist with safe URL check, max 50; parseChanges tolerant). lib/visualEditorToken.ts (HMAC with NEXTAUTH_SECRET, 2 h, one variation). lib/visualEditor.ts editableVariation (not control, no url, not completed, entitled) and saveChanges (audit variation:changes, clears config cache). Routes: GET/PUT /api/experiments/[id]/variations/[variationId]/changes, POST .../editor (link with fabt_editor), GET/PUT /api/sdk/visual (X-Editor-Token header, CORS, origin must be a project domain or localhost, user must still have project access). Bootstrap adds changes to the stay reply for visual variations on the control page (served even after a downgrade). SDK: generic loadModule; visual.js loads for changes (reveal after apply, flicker cap still applies) or for the editor (?fabt_editor or sessionStorage), no tracking in editor mode. public/visual.js hand written: MutationObserver until 2 s after load; editor UI in a shadow root, selector builder, revert on remove, token removed from the address bar. Obfuscator deadCodeInjectionThreshold lowered 0.4 to 0.3: public/sdk.js 95.5 KB raw, 25.5 KB gzip 6.

Error tracking: entitlement error_tracking (HEAVY, starter+, special friend toggle). Bootstrap adds modules: ['errors'] to stay replies of entitled orgs; SDK loads <module>.js generically from data.modules with window.__ABTestMod = reply (modules read the key from the sdk.js script tag and the API origin from their own src). public/errors.js: error and unhandledrejection listeners, own scripts ignored, max 20 distinct per page, 2 s debounce plus beacon on hide, first flag counts pages once. POST /api/sdk/errors (?key, text/plain, entitlement, origin, running test via cached getRunningConfig) -> telemetry errorBuffer -> error_daily (0023, when 1791972400000) upserts in the same d.batch; cappedErrorUpsert keeps 200 distinct fingerprints per test per day, rest to (other); (pages) row counts pages. lib/jsErrors.ts cleaning and fingerprint (sha1 of kind, message, source host+path, line). GET /api/experiments/[id]/errors?days. ErrorsPanel tab. Snippet now 23.1 KB gzip 6 (obfuscation unchanged).

## Popups (paid, 19 Oct 2026)
- Tables popups and popup_daily (migration 0024). Entitlement 'popups' (HEAVY, special friend toggle). Max 20 per project.
- Dashboard /popups (list, editor with preview, turn on or pause, delete). API /api/popups and /api/popups/[id], current project from the project cookie, audit entity 'popup'.
- Bootstrap adds popups (matching, active, cached under pop:projectId) and modules ['popups'] on every non-redirect reply for entitled orgs. The SDK module loop now runs outside the matched branch. Snippet 25.4 KB gzip-6 locally.
- public/popups.js: shadow DOM, textContent only, one popup per page view, frequency in local or session storage, exit intent on desktop only, Escape closes.
- Events: POST /api/sdk/popups (view, click, close), counted in a telemetry buffer and written in the same batch; rows for deleted popups are skipped.
- The experiment errors report now flushes telemetry before reading.

## Surveys (paid, 19 Oct 2026)
- Tables surveys, survey_daily and survey_responses (migration 0025). Entitlement 'surveys' (HEAVY, special friend toggle). Max 20 per project.
- Answers are buffered in telemetry and inserted in the same batch, capped at 500 kept answers per survey per UTC day (the response count in survey_daily keeps counting). Early flush at 500 pending answers. No visitor id stored; path without query.
- Dashboard /surveys (list, editor with preview, answers view with 7/30/90 days, CSV export with formula-safe cells). API /api/surveys, /api/surveys/[id] (GET results, PATCH, DELETE), /api/surveys/[id]/export, /api/sdk/surveys.
- Bootstrap adds surveys plus modules ['surveys'] like popups (cached under srv:projectId). sdk.js unchanged (no size change).
- public/popups.js and public/surveys.js are now built by scripts/build-modules.mjs from sdk-src/modules (shared kit.js: setup, display rules, beacons, shadow-root shell). One overlay per page view across both. Display rule schema and the dashboard fields are shared too (displayRules, DisplayRuleFields).

## Survey NPS and templates (19 Oct 2026)
- Survey type 'nps' (0 to 10, stored as text '0'..'10'); npsScore and summarizeAnswers return the score and groups. No migration (config JSON only).
- SURVEY_TEMPLATES in lib/surveys.ts (fill question fields only). Editor shows a template picker for new surveys.
- surveys.js renders an 11 point scale; sdk.js unchanged.

## Retention cleanup and answer redaction (19 Oct 2026)
- lib/redact.ts: EMAIL_RE, TOKEN_RE (shared with jsErrors), LONG_NUMBER_RE (6+ digits with single separators). Written survey answers and comments use redactText.
- lib/retention.ts: no cron. Bootstrap and capture call scheduleRetention(); each instance checks at most every 10 min, maintenance_runs (migration 0026) claims the 'retention' job at most hourly across instances; runs after the response. Deletes up to 5000 heatmap_points older than 30 days and up to 5000 survey_responses older than the org plan cutoff (free 183, starter and unknown paid 365, growth and enterprise 730 days) per run.
- The old 2% random heatmap prune in /api/capture is replaced.
- Pricing: 'Data retention' row replaced by 'Survey answers kept' and 'Individual heatmap clicks kept'; FAQ says what is deleted. Test events, assignments and results are not deleted (no retention on them yet). Audit log rows are not pruned and have no customer view yet.

## Heatmap filters (19 Oct 2026)
- heatmap_points gain source and visitor; heatmap_scroll_points stores one row per scroll batch (depth rounded to 10). Migration 0027.
- heatmap.js: src = utm_source, else referrer host (other site), else direct, cached in sessionStorage fabt_src; vid = ABTest.getUserId(). No sdk.js change.
- heatmapReport(exp, variation, device, days, filters): unfiltered uses rollups for 7/30/90 days; filtered reads raw tables over at most 30 days. Converted = visitor has a conversion event in the test (any goal); clicks without a visitor id are excluded from converted filters.
- Report and export take days, source, converted; report returns sources (top 20 by clicks, 30 days), filters and days.
- Retention deletes heatmap_scroll_points older than 30 days alongside raw clicks.
