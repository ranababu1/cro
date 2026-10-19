# Roadmap (approved 15 Oct 2026)

Internal. The public /roadmap page shows phase names, features and status only (no timelines, approach, competitors or scaling).
Public numbering: Phase 1 A/B testing core (done), Phase 2 more goals and targeting (in progress), Phase 3 heatmaps, Phase 4 recordings, funnels and visual editor, Phase 5 engagement extras.
Internal numbering below follows the approved plan, where "Phase 1" = public Phase 2. Scaling work: see docs/scaling.md.

Scaling fixes 1 to 5 from docs/scaling.md shipped 15 Oct 2026 (config cache, visitor counters, results rollups, batched telemetry, SDK batching).

Heavy features (heatmaps, recordings, raw capture) are paid only via lib/entitlements.ts (15 Oct 2026).

Special friend allowances in /admin (15 Oct 2026).

Free tier limits and 50 variations on paid plans (15 Oct 2026).

Public pricing, docs and roadmap aligned with enforced limits; Phase 2 marked Done publicly (15 Oct 2026).

- Done: free-tier domain rules and SDK domain enforcement.

- Done: install once guidance in the app and docs.

- Done: profile onboarding and profile check before creating tests.

- Done: WordPress plugin.

- Done: heatmaps on paid plans.

- Done: docs and pricing links in the app open in a new tab.

- Done: dark mode in the app.

Named goals: up to 50 per test, reorder and remove

Blog redesign

Blog post: how long to run an A/B test

Public copy matches how significance and traffic split edits work

WordPress plugin paid only, with download log and server-side key checks

Funnels built from goals (paid)

Later: SDK slimming

Revenue goals on custom events (paid)

Auto-shift traffic to the winner (Growth+); recordings postponed

Blog post 01 SDK size fix

Traffic overview (paid)

Heatmap compare side by side

Heatmap JSON export

Google Analytics 4 events

Traffic page paths capped at 500 per day per environment, extra paths roll into Other pages (paid)

Visual editor (Growth+)

JavaScript error tracking per version (paid)

- 19 Oct 2026: Popups and calls to action shipped (paid). Surveys next.

- 19 Oct 2026: Surveys shipped (paid). Phase 5 engagement extras complete.

- 19 Oct 2026: Survey NPS question type and templates shipped (paid).

- 19 Oct 2026: Retention cleanup (no cron) and survey answer redaction shipped.

Hardening pass 1 (19 Oct 2026): security fixes, PR fix/security-hardening.

Hardening pass 2 (19 Oct 2026): query indexes and script caching, PR perf/indexes.

Hardening pass 3 (19 Oct 2026): pricing copy for seats and projects. Next feasible: teammate invites (invite links, no email needed) and creating projects from the dashboard, enforcing the existing seats and projects limits.

Hardening pass 4 (19 Oct 2026): mobile layout, contrast and keyboard access, PR fix/mobile-a11y.

Gap proposal 1 done (19 Oct 2026): teammate invites, roles and multiple projects. Next: proposal 2 QA preview links, then proposal 3 sequential statistics.

- Done: QA preview links per variation (all plans, never counted).

- Done: blog post on A/B testing with low traffic.

- Done: public claims audit (pricing, docs, roadmap).

- Done: peeking-safe sequential statistics and chance to beat control.

- Done: results by segment (device, source, new or returning), paid plans.

- Done: roll out the winner (all plans, nothing counted).

- Blog: posts 01 to 03 refreshed for peeking-safe stats (2026-10-19).

- Done: SDK docs match the shipped snippet.

Admin-assigned plans and Enterprise for platform admin orgs: done

Blog breadcrumbs on posts 01 and 02: done

Scheduling with start and end dates, plus a gradual traffic ramp: done (proposal 6)
Demo page: removed; the hero demo button gets a video link later

Flaky sdk.obfuscated test: fixed

Webhooks for test events (signed, retried, paid): done (proposal 7)

- Done: page heatmaps for pages without a test (proposal 8), paid only, sampled, with stop rules and 30 day raw retention; sdk.js unchanged.

- Done: webhook deliveries pinned to the checked address (DNS rebinding closed).

## Status of the approved Phase 1 (public Phase 2): all items shipped 15 Oct 2026 (PRs #18, #20 to #25)
- [x] Page reach, form submit and custom event goals
- [x] Targeting: device, UTM, referrer, new vs returning
- [x] Edit running tests safely (weights, pause variation, add goal)
- [x] Sample ratio mismatch warning
- [x] Public share links for results
- [x] GTM and WordPress install guides
- [x] Monthly pageview quotas that pause collection at the cap

## Postponed (not feasible on the current stack, Imran 19 Oct 2026)
Kept off the public roadmap wording; public /roadmap stays high level.
- Postponed: session recordings (replay player, filters, links from heatmap dots and results). Needs object storage (R2 or Vercel Blob); Turso is too small for recording chunks.
- Postponed: anything that depends on recordings (JS errors linked to recordings, surveys linked to a recording). The non-recording parts can still ship.

## Next feasible items (in order, after revenue goals and auto-shift)
1. Done 19 Oct 2026: Traffic overview (paid; page views, entrances, top pages, sources, devices, countries).
2. Done 19 Oct 2026: Heatmap compare side by side (two versions, same device, shared colour scale).
3. Done 19 Oct 2026: Heatmap data export as JSON (paid, up to 20 variations, field guide in the file).
4. Done 19 Oct 2026: GA4 push (all plans): experience_impression via gtag or dataLayer, opt out with data-analytics="off".
5. Done 19 Oct 2026: Visual editor (Growth+): same-page variations with a change list (text, hide, safe styles, safe attributes) applied by lazy visual.js before paint; point-and-click editor on the customer page via a 2 hour signed link.
6. JavaScript error tracking, popup CTAs, surveys (lazy SDK modules, no recording links). Error tracking done 19 Oct 2026 (paid, errors.js, error_daily counters batched with telemetry, 200 distinct per test per day). Popups done 19 Oct 2026 (paid, popups.js on matching pages only, popup_daily counters batched with telemetry). Surveys done 19 Oct 2026 (paid, surveys.js shares a build-time kit with popups.js, answers batched and capped at 500 per survey per day).
7. Done 19 Oct 2026: Heatmap filters (date range, traffic source, converted or not; raw clicks, 30 days max when filtered).
8. Done 19 Oct 2026: Per-heatmap sampling and stop rules (sample percent, days or page views, new collection period).
9. Done 19 Oct 2026: Funnel trend (completion by start day or week, per variation).
10. Done 19 Oct 2026: Visual editor extras (move, page CSS, tablet and mobile editor windows).
11. Done 19 Oct 2026: Customer audit log view (paid, read-only) with audit retention by plan; pricing row corrected (Free not included, Enterprise 2 years instead of Custom).

## Approved phases

### Phase 1: Finish A/B testing to Crazy Egg level (about 2 to 3 weeks)
Scope:
- New goal types: page reach (URL equals/contains/regex), form submit (selector), custom event (`fab.track('name')`).
- Targeting per test: device type, UTM params, referrer, new vs returning, URL query. Evaluated in the SDK before bucketing.
- Edit while running: change weights, pause a variant, add a goal.
- Sample ratio mismatch warning in Results.
- Public share link for results (signed read-only token, revocable).
- Install guides for GTM and WordPress (manual header) in /docs.
- Quotas by tracked pageviews per month, pause collection at cap (no overage), shown in settings and admin.
Technical approach: all in the existing SDK and event ingest. Targeting rules stored as JSON on the experiment and shipped in the config the SDK already loads. No new tables except share tokens.

### Phase 2: Heatmaps and light analytics (about 4 to 5 weeks)
Scope:
- SDK capture module, off unless a heatmap or test is active for that URL: clicks (x/y relative to the clicked element plus a stable CSS selector path, page width bucket), max scroll depth per pageview, rage clicks (3+ clicks in 1s within 30px), dead clicks (no navigation or DOM change after click).
- Reports: List (element, clicks, %, CSV), Click map, Scroll map, Confetti, Overlay. Device split desktop/tablet/mobile.
- Heatmaps auto-created for each variant of a running test.
- Filters: date, device, source/UTM, converted yes/no.
- Per-heatmap sampling rate and stop rules (days or visits), like Crazy Egg's 60 days / 25,000 visits default. Done 19 Oct 2026 (per test, default 50% sample and no stop rule).
- Light web analytics: pageviews, unique visitors, top pages, sources, devices, country (from Vercel geo header).
- GA4 push: dataLayer event with experiment and variant.
Technical approach:
- Rendering: show the real page in a sandboxed iframe inside the dashboard and paint clicks on a canvas over it, mapping by selector so layout changes and responsive widths still line up. For pages that cannot be framed, fall back to a DOM snapshot the SDK sends once per heatmap per device (HTML plus inlined CSS links, size capped). This avoids building a screenshot service or a browser extension.
- Storage: raw clicks are the cost. Batch in the SDK (send every 5s or on pagehide via sendBeacon), keep raw click rows 30 days on free, and roll up into an aggregate table keyed by heatmap, device, selector and a 1% grid cell. Scroll depth stored as a histogram (10 buckets) per day. Rough math: 1 click row about 60 bytes; 100k pageviews with 3 clicks each is about 18 MB raw per month, which fits Turso free limits for early users. Default sampling on free plan to keep writes under the free tier's monthly row-write limit, and cap heatmaps per plan.
- Ingest stays a Vercel route; move to an edge route with batched inserts to keep function invocations low.
- Privacy: never capture text content of inputs, only element selectors and positions; IPs hashed as today.

### Phase 3: Recordings, funnels and visual editor (about 6 to 8 weeks)
Scope:
- Postponed (needs object storage): session recordings with replay player, filters (converted, page, device, rage click), links from heatmap dots and test results.
- Funnels built from existing goals: per step visitors, drop-off, trend.
- Visual editor tests (from the existing roadmap): text, image, link, hide, move, custom CSS/JS, device preview.
- Multi-armed bandit split option. Done 19 Oct 2026 as auto-shift traffic to the winner (Growth+).
- Heatmap compare side by side.
Technical approach:
- Recordings use the open source rrweb library loaded lazily only for sampled sessions, so the base SDK stays small.
- Privacy: mask all input values and elements marked `data-fab-mask` by default, block password and card fields entirely, honor Do Not Track and a consent flag, configurable retention.
- Storage: recordings are too large for Turso. Store compressed chunks in object storage (Cloudflare R2 free tier 10 GB, or Vercel Blob) and keep only metadata in Turso. Expect roughly 100 to 300 KB per compressed session, so 1,000 recordings is about 0.2 GB. Hard caps per plan (Crazy Egg gives 50 to 10,000 per month).
- Visual editor: the SDK applies a list of DOM changes before paint using the same anti-flicker hide it uses today.
- Bandit: Thompson sampling that rewrites weights. Shipped without a cron: the check runs after SDK requests (at most hourly per test, claimed atomically), since Vercel Hobby cron runs only daily.

### Phase 4: Engagement tools and extras (about 4 to 6 weeks, pick per demand)
Scope:
- JavaScript error tracking: window.onerror and unhandledrejection, grouped by message and stack, linked to recordings.
- Popup CTAs: bar, popup, button with page/device/time/exit-intent triggers and click rate.
- Surveys: small template set (NPS, one question, open text), triggers, link to recording.
- WordPress plugin that injects the snippet.
- Export of heatmap data as JSON for use in any AI tool.
Technical approach: each is a lazy-loaded SDK module fetched only when the project has one active, so sites that only run tests do not pay the weight.

## 5. Skip or defer, and why
- AI analysis summaries: needs a paid model and per-report cost; JSON export gives most of the value for free. Revisit later.
- Live view and Astro map: fun but low value, and real-time push costs money on Vercel.
- Ad pixel and ecommerce goals: many platform-specific integrations; custom event goal covers it.
- Shopify, Wix, Squarespace, Drupal, Joomla, Magento, Segment apps: maintenance load; GTM plus manual header covers nearly all sites.
- Page Camera browser extension: replaced by DOM snapshot from the SDK.
- SAML SSO: only matters for enterprise buyers; Google login is enough for now.
- 50+ survey templates and AI sentiment: start with 3 templates.

## 6. Risks
- Free tier limits on Turso writes and Vercel invocations once heatmaps run. Sampling, batching and roll-ups are required, not optional.
- Recordings and DOM snapshots carry privacy risk. Masking on by default, and a DPA and privacy page before launch.
- SDK size: capture, recordings, surveys must be separate lazy modules; the base file stays as is.
- Public pages must not describe internals (R2, rrweb, Turso) per our existing rule.

## 7. Decision needed from Imran
Approve the phase order (A/B finish, then heatmaps, then recordings and editor, then CTAs, surveys and errors), or reorder. On approval, Phase 1 starts and docs/roadmap.md gets updated in the repo.


---

# Previous plan (superseded, kept for history)

## Shipped
- Platform telemetry for super-admins (/admin/telemetry): daily aggregates, charts, drill-downs, CSV.
- URL split flow with domains, click goals, plan variation limits (free 1 / paid 10), and automatic SDK.

# CRO A/B Testing Platform: 3-Phase Roadmap

Repo: ranababu1/cro (main @ 5c9fc1d "Toast added - wip"). Plan only, no repo changes made.

## 1. Current state audit

| Area | What exists | Verdict |
|---|---|---|
| Stack | Next.js 16 App Router, React 19, TypeScript, Tailwind 4 (DaisyUI removed in the Oct 2026 redesign) | Keep |
| Auth | next-auth v4, Google provider only, JWT sessions | Keep for Phase 1, move to Auth.js v5 or Better Auth when adding orgs, SSO, MFA |
| Database | `lib/db.ts` is an in-memory store that pattern-matches SQL strings. `lib/schema.sql` is a SQLite/D1 schema that is never actually used. Data is lost on restart | Replace. Postgres + Drizzle ORM with migrations |
| Data model | users, experiments (owned by a single user), variations, assignments, events (page_view/conversion only) | Rework: add orgs, projects, environments, goals, metrics, audiences |
| Assignment | `lib/assignment.ts`: SHA-256 of `experimentId:userId`, separate traffic hash, weighted buckets | Logic is sound, reuse. Switch to MurmurHash3 so the browser SDK can bucket locally with identical results |
| Assignment API | `/api/assign` does a server round trip and stores every assignment row | Replace with config download + local bucketing; keep server as fallback |
| SDK | Two overlapping vanilla JS files (`public/sdk.js`, `public/ab-sdk.js`), localStorage visitor ID, promise based `getVariation` | Replace with one typed SDK package. No anti-flicker today |
| Stats | `lib/statistics.ts`: two-proportion z-test, Wilson CI, lookup table z-scores | Reuse as base; add proper normal CDF/inverse, Welch t-test for revenue, SRM chi-square |
| Tracking | `/api/track`, single event insert, validates experiment exists | Replace with batched ingestion endpoint and event table designed for volume |
| UI | dashboard, new experiment, experiment detail pages, navbar, dev toast | Reuse styling and page shells; rebuild forms |
| Tests | None. No test runner configured | Add Vitest (unit) and Playwright (SDK + UI) |
| CI/Deploy | No GitHub Actions. README targets Vercel + Cloudflare D1 | Add CI. Vercel for app, Cloudflare/CDN for SDK + config |
| Security | Track/assign endpoints are unauthenticated and have no API keys, no rate limits, no CORS policy | Must fix in Phase 1 |

Summary: a working demo of the core idea (deterministic bucketing + z-test) with no persistence, no multi-tenancy, no tests, and no production SDK. Roughly 1,500 lines; the hashing and stats modules are worth keeping, most of the rest gets rebuilt.

## 2. Recommended architecture

- Monorepo (pnpm workspaces + Turborepo):
  - `apps/web`: Next.js dashboard and management REST API.
  - `apps/ingest`: event ingestion service (Next route handler at first, later a Cloudflare Worker or small Node/Hono service).
  - `packages/core`: shared, dependency-free TypeScript: hashing, bucketing, targeting rule evaluation, config schema. Used by every SDK and the server so results match everywhere.
  - `packages/stats`: statistics engine, pure functions, heavily unit tested.
  - `packages/sdk-js`: browser SDK. `packages/sdk-node`, later `sdk-react`, `sdk-python`, `sdk-java`, `sdk-php`.
- Database: Postgres (Neon or Supabase) with Drizzle for app data. Events start in a Postgres partitioned table; move to ClickHouse (or Tinybird) in Phase 2 when volume needs it. Design the ingest layer so the switch does not touch SDKs.
- Config delivery: on publish, compile each environment's running experiments into a JSON "datafile", push to object storage behind a CDN (Cloudflare R2 or Vercel Blob). SDKs fetch it, evaluate locally, no per-visitor server call.
- Jobs: a queue (Inngest, or pg-boss on Postgres) for stats rollups, scheduled reports, webhooks, retries.
- Validation: Zod schemas shared between API, UI and datafile.
- Observability: Sentry for app + SDK errors, basic structured logs.

## 3. Data model sketch

```
organizations(id, name, slug, plan, created_at)
memberships(org_id, user_id, role)            -- role: owner/admin/editor/viewer (Phase 1 owner/member only)
users(id, email, name, image)
projects(id, org_id, name, domain_allowlist)
environments(id, project_id, key: dev|staging|prod, sdk_key, datafile_version)
api_keys(id, project_id, env_id, type: sdk|secret, hash, last_used_at, revoked_at)

experiments(id, project_id, key, name, hypothesis, type: ab|abn|mvt|split_url|redirect|flag_rollout,
            status: draft|review|scheduled|running|paused|completed|archived,
            owner_id, tags[], category, traffic_allocation, layer_id, seed,
            start_at, end_at, primary_metric_id, created_at, updated_at)
variants(id, experiment_id, key, name, is_control, weight, payload jsonb)   -- payload: js/css/html, redirect url, flag value
experiment_environments(experiment_id, env_id, enabled, allocation_override)
audiences(id, project_id, name, rules jsonb)                 -- reusable include/exclude rule tree
experiment_audiences(experiment_id, audience_id, mode: include|exclude)
metrics(id, project_id, name, type: binomial|count|revenue|ratio, event_name, filters jsonb,
        aggregation, attribution_window_hours, direction, is_guardrail)
experiment_metrics(experiment_id, metric_id, role: primary|secondary|guardrail)
layers(id, project_id, name)                                 -- Phase 2, mutual exclusion
feature_flags(id, project_id, key, type, default_value, rules jsonb)  -- Phase 2
audit_log(id, org_id, actor_id, entity, entity_id, action, diff jsonb, at)

-- event store (Postgres partitioned by day, later ClickHouse)
exposures(project_id, env_id, experiment_id, variant_id, visitor_id, user_id, ts, ctx jsonb)
events(project_id, env_id, event_id, event_name, visitor_id, user_id, value, ts, props jsonb, ctx jsonb)
-- ctx: device, browser, os, country, url, referrer, utm, is_new
metric_rollups(experiment_id, variant_id, metric_id, day, segment_key, n, sum, sum_sq, conversions)
```

Key change from today: assignments are not stored per visitor on the server. Assignment is a pure function of (seed, visitor id, config); the SDK sends an exposure event once per session, and analysis joins exposures to events.

## 4. Phase plan

Every feature from the 14-section list appears in exactly one phase.

### Phase 1: Usable MVP

Goal: a team can install one snippet on a real site, run code-based A/B and A/B/n tests safely, and trust the result.

1. Experiment Management
- Create, edit, pause, resume, archive experiments
- A/B testing (control vs variant)
- Split testing with configurable traffic allocation
- A/B/n testing
- Redirect testing
- URL-based split testing (same mechanism as redirect, shipped together)
- Scheduling with start and end dates
- Naming, tagging, categorization, ownership
- Statuses: draft, running, completed, archived (plus paused). Review status lands with approvals in Phase 2

2. Visual Editor: none (Phase 3), but code variants are the Phase 1 authoring path, see section 9 note below. Items from section 2 that are code features are listed here:
- HTML, CSS and JavaScript injection
- Code-based variant creation
- Duplicate and clone variants

3. Traffic Allocation
- Percentage-based distribution
- Equal or weighted splits, custom allocation (50/50, 70/30, 90/10)
- Visitor-level random assignment
- Persistent assignment across sessions
- Cookie-based and user-ID-based bucketing
- Exclude internal traffic (IP list, query param opt-out), bots (UA list), and test users
- Traffic allocation validation (weights sum to 100, warns if changing a running test)

4. Targeting
- URL and page-path targeting
- Query parameter and UTM targeting
- Device targeting
- Browser and OS targeting
- New vs returning visitor
- Include and exclude rules

5. Goals and Conversion Tracking
- Primary and secondary goals, multiple goals per experiment
- Click tracking (CSS selector goals)
- Form submission tracking
- Custom event tracking
- Signup and registration tracking (as named custom events)
- Purchase and revenue tracking
- Conversion deduplication (event_id idempotency + once-per-visitor binomial metrics)

6. Statistical Analysis
- Conversion rate
- Relative and absolute uplift
- Confidence intervals
- Statistical significance testing, frequentist (z-test for proportions, Welch t-test for revenue)
- Sample-ratio mismatch detection (chi-square on exposures)
- Sample size calculator, MDE, power, required duration estimate (one calculator, same math)
- Winner, loser, inconclusive classification

7. Analytics and Reporting
- Experiment dashboard (near real time, rollups every few minutes)
- Visitors and unique users per variant
- Conversion rate comparison
- Uplift and CI visualization
- Daily and cumulative trends
- CSV export

9. SDKs and Integrations
- JavaScript web SDK
- REST API (management, secret key auth)
- Event ingestion API

10. Performance and Reliability
- Asynchronous script loading
- Flicker-free rendering (small sync anti-flicker snippet with hard timeout, hides only targeted selectors)
- CDN-based delivery of SDK and datafile
- Low-latency variant delivery (local evaluation, no network call per visitor)
- SPA and client-side navigation support (history API hooks re-evaluate URL targeting)
- Duplicate event prevention
- Event delivery retries (batched beacon with localStorage queue)

11. Governance
- Organization and team management (single role "member" plus owner)
- API key management (SDK keys and secret keys per environment, rotate, revoke)
- Environment separation for dev, staging, production
- Audit logs (basic: who changed what, when; also covers experiment history in section 1)

13. Admin
- Multi-tenant organization support
- Projects and environments
- Platform super-admin role, separate from org roles (bootstrapped from PLATFORM_ADMIN_EMAILS)
- Platform admin console: all tenants with members, projects, experiment counts, visitor and event usage
- Suspend and reactivate tenants (blocks SDK keys, secret keys and dashboard)
- Basic plan fields on orgs (plan name) and usage tracking and quotas (moved from Phase 2)
- Monthly active experiment and visitor limits, basic enforcement (moved from Phase 3)
- Admin actions written to the audit log

Phase 1 exit criteria
- Real persistence (Postgres) with migrations; no in-memory store anywhere.
- Snippet installed on at least one real site (for example imraan.in) running a live A/B test for 2 weeks with no visible flicker and SDK under 15 KB gzipped.
- Same visitor gets the same variant in browser SDK and Node bucketing tests (cross-implementation test vectors).
- Stats engine verified against known reference values (e.g. scipy outputs) and an A/A test shows no false winner and no SRM.
- Ingest handles 200 events/sec sustained in a load test without loss.
- Unit test coverage on `core` and `stats` above 90%; CI runs lint, typecheck, tests on every PR.
- Every write endpoint authenticated; ingest restricted by SDK key + domain allowlist + rate limit.

### Phase 2: Depth, trust, and integrations

Goal: credible for a team running many tests in parallel, with server-side use, proper governance, and better stats.

1. Experiment Management
- Multivariate testing (MVT), needs factorial variants and multiple-comparison correction
- Approval workflows and the review status
- Experiment history UI on top of the audit log (detailed diffs)

3. Traffic Allocation
- URL and domain-level traffic splitting
- Allocation adjustments during an experiment (with re-randomization warnings and safe ramp only)
- Audience-specific traffic allocation
- Holdout groups for incremental impact
- Traffic allocation monitoring (alerts when actual split drifts)

4. Targeting
- Geographic targeting (CDN geo headers)
- Logged-in vs anonymous
- Referrer-based targeting
- Custom JavaScript conditions
- User attribute and event-based targeting
- Custom audience creation and reuse
- Targeting by experiment, campaign or cohort

5. Goals
- Add-to-cart and checkout tracking
- Funnel conversion tracking
- Micro and macro conversions
- Revenue per visitor
- Average order value
- Custom metric definitions (ratio, count, filtered metrics)
- Goal attribution windows

6. Statistical Analysis
- Bayesian analysis (beta-binomial, probability to beat control, expected loss)
- Sequential testing support (always-valid p-values, mSPRT or group sequential)
- Multiple-comparison correction for A/B/n and MVT (Holm or Benjamini-Hochberg)
- Guardrail metric monitoring
- Early stopping rules (built on sequential testing)
- Novelty effect detection
- Results by audience segment (done for device, landing source and new or returning; custom audiences later)

7. Reporting
- Revenue and engagement metrics views
- Funnel analysis
- Device and browser breakdowns
- Geographic and audience breakdowns
- Experiment comparison reports
- PDF reports
- Scheduled reports by email
- Shareable reports (signed read-only links)
- Result summaries and recommendations (rule-based text, AI version in section 12)

8. Personalization and Feature Delivery
- Feature flags
- Percentage rollouts
- Gradual feature releases
- User and account-level targeting
- Remote configuration
- Experiment-driven feature rollouts
- Mutual exclusion between conflicting experiments
- Experiment layers and namespaces
- Server-side experimentation
- Rule-based content delivery

9. SDKs and Integrations
- Server SDKs: Node.js, Python, PHP, Java (Node first; others generated from `core` test vectors)
- React and Next.js integration (provider, hooks, middleware bucketing for SSR)
- WordPress integration (plugin that injects snippet, configures keys, ecommerce events for WooCommerce)
- Google Analytics 4 integration (push exposures as events)
- Google Tag Manager integration (template + dataLayer events)
- Webhook support
- Consent management platform integration (Cookiebot, OneTrust, TCF v2)

10. Performance and Reliability
- Server-side rendering support
- Caching compatibility (edge-cache-safe variant keys, Vary guidance)
- Experiment collision detection (same selectors or URLs in two running tests)
- Script error monitoring (SDK reports variant JS errors, auto-pause on threshold)

11. Governance
- Role-based access control (owner, admin, editor, viewer)
- SSO (Google Workspace, SAML/OIDC) and MFA
- Experiment approval and publishing permissions
- Experiment access restrictions (per-project permissions)
- Consent-aware experimentation (no tracking before consent, configurable)
- PII masking and data minimization (strip query params, hash user IDs)
- Secure handling of customer identifiers
- Data retention policies

12. AI basics
- Explain experiment outcomes in plain language
- AI-generated experiment reports
- Guardrails against unsupported statistical conclusions (AI text constrained to computed stats; refuses to call winners the stats engine did not)
- AI-assisted experiment ideation
- Prioritize experiments by impact, confidence, effort (ICE scoring with AI suggestions)

13. Admin
- User and team permissions UI
- API usage monitoring
- Data export and account deletion (needed for GDPR)

Phase 2 exit criteria
- At least 10 concurrent experiments in one project with layers and no collisions.
- Node SDK and React/Next integration used in production; WordPress plugin installable.
- Bayesian and sequential results match reference implementations; sequential A/A simulations keep false positive rate at or below alpha.
- RBAC and SSO enforced on every endpoint, covered by tests.
- Consent mode tested with at least one CMP; GDPR export and deletion work end to end.
- Event store migrated to ClickHouse (or justified decision to stay on Postgres) with dashboards under 2 s at 10M events.

### Phase 3: Visual editor, advanced experimentation, AI-heavy, scale

2. Visual Editor and Variant Creation
- Visual no-code editor (loads customer page in an iframe via a bookmarklet/extension, records changes as selector-based ops)
- Edit text, images, buttons, colors, layouts, CSS
- Drag-and-drop element editing
- Preview across desktop, tablet, mobile
- Responsive design validation
- Change comparison between control and variants
- Undo and redo

4. Targeting
- Audience segments based on behavioral history (needs the event store and profile service)

5. Goals
- Lead quality and qualified lead tracking (needs CRM integration)

6. Statistical Analysis
- None remaining (all placed in Phases 1 and 2)

8. Personalization
- Personalized website experiences
- Audience-specific content variations
- Persistent control groups (long-lived, cross-experiment)

9. SDKs and Integrations
- Segment and CDP integrations
- CRM and marketing automation integrations (HubSpot, Salesforce)
- E-commerce platform integrations (Shopify app, beyond WooCommerce)
- Data warehouse exports (BigQuery, Snowflake)

10. Performance and Reliability
- Edge-based experimentation (Cloudflare Worker / Vercel middleware rewriting HTML)
- High-availability architecture (multi-region ingest, queue buffering)
- Performance impact monitoring including Core Web Vitals per variant

12. AI-Powered
- Generate test hypotheses from analytics data
- Suggest high-impact pages and opportunities
- AI-generated copy and CTA variants
- AI-assisted HTML and CSS changes (inside the visual editor)
- Automated experiment setup
- Conversion funnel anomaly detection
- Recommend follow-up experiments
- Identify audience segments with differing responses (heterogeneous effect analysis)

13. Admin and Billing
- Event ingestion limits
- Plan management and billing (Stripe)
- System health dashboard
- Operational alerts

14. Advanced Experimentation
- Bandit experiments and traffic optimization
- Multi-page and cross-domain experiments
- Cross-device identity resolution
- Geo experiments and holdout-based incrementality
- CUPED or other variance reduction
- Sequential and adaptive experimentation (adaptive allocation beyond Phase 2 sequential tests)
- Interleaving experiments for ranking systems
- Interaction and interference analysis
- Long-term retention and cohort analysis
- Incrementality measurement for campaigns
- Offline conversion imports

Phase 3 exit criteria
- Non-technical user can build and launch a test in the visual editor without code on 3 real sites.
- Billing live with enforced quotas.
- Edge delivery path shows zero flicker and no CWV regression versus control.
- CUPED shows measurable variance reduction on historical experiments.

Note on CUPED: listed as Phase 3 because it needs pre-experiment covariate data per visitor, which only exists once the event store has history. If the Phase 2 event store lands early, CUPED is a cheap pull-forward.

## 5. Key dependencies

- `packages/core` (hashing, rules, datafile schema) blocks the JS SDK, server SDKs, edge delivery and feature flags. Build it first.
- Exposure events + event store block every stats and reporting feature. Exposure logging must be right from day one or past data is unusable.
- Orgs/projects/environments must exist before API keys, RBAC, quotas and billing. Doing tenancy later means a painful migration, so it is in Phase 1.
- Audit log (Phase 1) is the base for approvals, history UI and compliance.
- Sequential testing must come before early stopping rules and before AI "call a winner" text.
- Layers/mutual exclusion come before running many tests at once, and before bandits and holdouts.
- Consent integration must precede any EU customer go-live.
- Visual editor depends on the selector-based change ops and SPA support from Phases 1 and 2; AI HTML/CSS and AI copy variants depend on the editor.
- Behavioral audiences, cross-device identity and segment discovery depend on a profile/identity service built over the event store.

## 6. Key risks

- Flicker and performance: a slow snippet hurts the customer's conversion rate and SEO. Mitigate with size budget, timeout, CDN, and later edge delivery.
- Statistical correctness: wrong math destroys trust. Mitigate with reference tests, A/A runs, SRM checks surfaced loudly, and sequential methods before encouraging peeking.
- Peeking: users stop tests early on noise. Show "not enough data" states until sample size reached; Phase 2 sequential testing fixes it properly.
- Event volume and cost: Postgres will strain. Keep ingest behind an interface and plan the ClickHouse move.
- Ad blockers and ITP: third-party domains and cookies get blocked. Offer first-party proxy path (customer subdomain or WordPress plugin route) early.
- Privacy/legal: cookies and tracking need consent in the EU. Ship consent-aware mode before EU users.
- Scope: the list is the size of Optimizely + LaunchDarkly + Amplitude. Hold the phase lines; Phase 1 should take about 8 to 10 weeks for one or two engineers.
- Existing code drift: two SDK files and an unused schema already diverge. Delete rather than patch.

## 7. Phase 1 milestones and first issues

M0. Foundation (week 1 to 2)
1. Convert repo to pnpm monorepo (`apps/web`, `packages/core`, `packages/stats`, `packages/sdk-js`). Not started. Deferred to the start of M1 so `packages/core` is created together with the new SDK.
2. Add Vitest, Playwright, GitHub Actions (lint, typecheck, test, build). Done except Playwright, which moves to M1 with the SDK.
3. Add Postgres + Drizzle, write initial migration from the data model above; delete in-memory `lib/db.ts` and unused `schema.sql`. Done with SQLite/libSQL instead of Postgres so dev needs no hosted DB; production uses Turso. Schema uses portable types so a Postgres port stays cheap.
4. Orgs, memberships, projects, environments; keep Google login; scope every query by org. Done (scoped by project membership).
5. API keys per environment (SDK key public, secret key hashed), key management UI. Done. All keys are stored as hashes and shown once.
6. Audit log table and write helper used by all mutations. Done for experiments, keys and org creation. Tenant audit log visible in the admin console.
7. Platform admin and tenant controls (added to Phase 1 on 2026-10-14). Done: super-admin role from PLATFORM_ADMIN_EMAILS, /admin console, suspend and reactivate, plan and monthly limits per org, quota hooks on new visitors and experiment starts, admin actions audited. Billing (Stripe) stays in Phase 3.

M1. Core + SDK (week 3 to 5)
7. `packages/core`: MurmurHash3 bucketing, traffic allocation, weighted variants, shared test vectors; port logic from `lib/assignment.ts`.
8. Targeting rule engine: URL/path, query/UTM, device, browser, OS, new/returning, include/exclude.
9. Datafile compiler + publish to CDN storage on every experiment change.
10. `sdk-js`: visitor ID (first-party cookie + optional user ID), local evaluation, exposure events, `track()`, batching, retry queue, dedupe IDs, SPA navigation hooks.
11. Anti-flicker snippet with timeout and selector scoping; code variants (JS/CSS/HTML injection); redirect and split URL handling.
12. Internal traffic, bot and QA exclusions; forced variant via query param for QA.
13. Remove `public/sdk.js` and `public/ab-sdk.js`; update `public/demo.html` to the new SDK.

M2. Ingest + stats (week 5 to 7)
14. Batched ingest endpoint: SDK key auth, domain allowlist, rate limit, Zod validation, idempotency by event_id.
15. Partitioned exposures/events tables and periodic rollup job.
16. Metrics model: binomial, count, revenue; click/form/custom/purchase goals; primary and secondary.
17. `packages/stats`: port z-test and Wilson CI, add exact normal CDF, Welch t-test, absolute/relative uplift with CIs, SRM chi-square, sample size/MDE/power/duration.
18. Reference tests against scipy outputs; A/A simulation test.

M3. Product UI (week 7 to 9)
19. Experiment CRUD with statuses, scheduling, tags, owner, clone variant, code editor for variants.
20. Results page: per-variant visitors, conversions, CR, uplift + CI chart, daily/cumulative trend, SRM banner, winner/loser/inconclusive.
21. Sample size calculator page.
22. CSV export.
23. Install guide page with copy-paste snippet per environment.

M4. Pilot (week 9 to 10)
24. Load test ingest at 200 events/sec.
25. Run an A/A test then a real A/B test on a pilot site; fix issues; tag v0.1.0.
