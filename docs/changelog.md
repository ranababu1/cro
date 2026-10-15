# Changelog

Newest first. Times are IST (UTC+5:30). Every change adds a row here (see docs/agent.md).
For the commit that adds a row, write "pending" as the ID, then fill in the short hash in the next commit.

| Commit | Date and time (IST) | Summary |
|---|---|---|
| pending | 2026-10-15 12:20 IST | docs: internal scaling assessment (docs/scaling.md): bottlenecks, Turso limits, ordered fixes. |
| ef4f7f7 | 2026-10-15 03:38 IST | Trimmed README to overview and features only |
| 79d28d0 | 2026-10-15 03:40 IST | feat: live stats while a test runs. Results tab shows visitors, per-variation visitors and redirects (new server-side redirect event at bootstrap), goal clicks per CSS selector by variation ranked by clicks, conversion rate with Wilson 95% CI, uplift vs control with 95% CI, plain status (ahead / too early to call), daily visitors chart, 30 s auto-refresh, empty state. Experiments list shows visitors, clicks and result so far. 9 new tests. |
| d8fc076 | 2026-10-15 03:25 IST | fix: migration 0004 (api_keys.key_plaintext) was skipped on existing DBs because its journal timestamp was older than 0001; bumped it, added migration-order test, install API returns a clear error. |
| 2db18d1 | 2026-10-15 02:55 IST | fix: auto-create public SDK keys and pre-fill install snippets with https://www.freeabtest.com + real key; Production/Development toggle; store SDK key plaintext (secrets stay hash-only). |
| pending | 2026-10-15 02:45 IST | fix: auto-redistribute variation weights so they always total 100 when editing one weight in the create-experiment wizard. |
| pending | 2026-10-15 02:25 IST | fix: replace default Next.js favicon with freeabtest leaf mark (blue-to-teal gradient). Add favicon.ico, apple-touch-icon, app/icon.png, app/apple-icon.png; remove public/next.svg. |
| pending | 2026-10-15 02:15 IST | build: obfuscate public/sdk.js from sdk-src at build time (javascript-obfuscator: mangled ids, stringArray rc4/base64, control-flow flattening, dead-code injection). Multi-line output ~50 KB / ~1500 lines (~14 KB gzip). Homepage and docs size claims updated. Also add @vercel/analytics on every page via root layout. |
| e8522cf | 2026-10-14 21:45 IST | feat: platform telemetry in super-admin /admin console. Daily aggregated counters (signups, logins, tests, domains, SDK assign/exposure/goal, visitors, conversions, API keys, errors, rate limits). Overview with DAU/WAU/MAU and trend charts, top users/orgs, drill-downs, date range, CSV export. Product-usage events with hashed IPs only. |
| 9fb471c | 2026-10-14 21:00 IST | feat: URL split test flow. Domains per project with Origin/Referer allowlist, wizard (domain, control URL, variations, click goals, traffic, review), plan limits (free 1 variation, paid 10), auto SDK with flicker-free redirect, click goals, dedupe, sendBeacon, bot filter. One-line install snippet. Per-goal results. Demo pages. |
| 02d6a60 | 2026-10-14 19:55 IST | docs: remove the Self-hosting page and admin console docs from public docs; scrub internals (database, hosting, env vars, rate limiter details, hashing details, instance wording, admin API) from docs, pricing FAQ and troubleshooting. Organizations page rewritten for customers (organizations-and-projects). New test asserts no public page contains internal terms (76 tests) |
| c23f068 | 2026-10-14 19:45 IST | feat(docs): in-product documentation at /docs. 13 pages verified against the code, sidebar nav, on-page TOC, client-side search, copyable code blocks, callouts, diagrams. Linked from site nav, footer and app sidebar (replacing the README link). 6 new tests (73 total) |
| dbf6d57 | 2026-10-14 19:25 IST | feat(landing): rebuild the homepage to the mockup's exact structure and proportions. Larger hero and richer dashboard mock, mockup-style logo row, How it works heading row and tinted cards, large layered Test anything illustration, 4-column stats strip, footer. Removed code block, features, roadmap, pricing, FAQ and CTA band from the homepage; pricing and FAQ moved to /pricing, features and roadmap to /roadmap |
| 36dbfd0 | 2026-10-14 19:05 IST | feat(theme): replace the green accent with blue (#2563eb) and teal (#0d9488, #14b8a6) across landing and app. Brand tokens, leaf logo, gradient headline, blobs, landing illustrations and demo page button. Status colors (Running, Completed, positive lift) stay green |
| 616b591 | 2026-10-14 18:20 IST | feat(landing): rebuild the landing page to the homepage mockup and rebrand to freeabtest.com. Leaf logo, nav dropdowns, gradient hero headline, example-data dashboard mock, handwritten annotation, Works with your stack row (planned items marked), How it works cards, Test anything section, stats strip of verified product facts, animated background blobs (reduced motion respected). Brand accent changed from indigo to green across the app |
| 9d6f931 | 2026-10-14 16:20 IST | feat(ui): redesign the whole site in a clean light B2B style. New component set, app shell with sidebar and project switcher, marketing landing page, sign-in page, overview, experiments list, edit settings, results with lift and interval chart, restyled API keys and admin console. DaisyUI removed. 3 new tests (67 total) |
| 24a95db | 2026-10-14 15:34 IST | Squash merge of PR #1 into main (contains the cec2adc and 4934497 work below; those IDs exist only on the PR branch) |
| cec2adc | 2026-10-14 15:15 IST | feat: platform admin and tenant controls. Super-admin role from PLATFORM_ADMIN_EMAILS, /admin console with tenant list, usage and details, suspend and reactivate (blocks SDK keys, secret keys and dashboard), plan and monthly visitor and experiment limits with basic enforcement, admin actions audited, 10 new tests (64 total) |
| 4934497 | 2026-10-14 11:48 IST | feat: Phase 1 M0 foundation. SQLite/libSQL with Drizzle and migrations, orgs, projects, dev/staging/prod environments, hashed API keys, audit log, SDK key auth and rate limiting on assign and track, session or secret key auth with project scoping on experiment APIs, Zod validation, key management page, stats fixes, Vitest suite (54 tests), GitHub Actions CI |
| 8c1a889 | 2026-10-14 09:38 IST | docs: restore changelog instruction wording |
| 0b3369e | 2026-10-14 09:38 IST | docs: fill commit ID in changelog |
| a6cdf7f | 2026-10-14 03:40 IST | docs: add roadmap, agent guide, changelog and current state docs |
| 5c9fc1d | 2026-01-11 14:30 IST | Toast added - wip |
| fc520ae | 2026-01-11 10:53 IST | Messaging updated |
| 51a9e94 | 2026-01-11 00:00 IST | Closing updated |
| b765c57 | 2026-01-10 23:53 IST | Auth added. UI Updated |
| 759f0e7 | 2025-12-13 22:22 IST | Experiments setup updated |
| 3322f4f | 2025-12-13 10:22 IST | Minor Update |
| 3bed0c1 | 2025-12-13 09:34 IST | Initial commit from Create Next App |
