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
