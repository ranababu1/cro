# Agent and Developer Guide

Read this before changing anything in this repo. It applies to people and AI agents alike.

For the marketing site redesign, also read `docs/plan.md` (roadmap, sitemap, capability inventory, design system) and `docs/instructions.md` (rules for that work: architecture, tests, Git, public copy). Rules here win where both cover the same topic.

## Required on every change
1. Update `docs/changelog.md`: add a row at the top with commit ID, date and time in IST, and a one-line summary.
2. Update `docs/currentstate.md` so it describes the app as it is after your change (features, known gaps, stack).
3. If your change moves a roadmap item forward, mark it in `docs/roadmap.md`.
A change without these updates is incomplete.

## Stack conventions
- Next.js App Router with TypeScript in strict mode. React 19. Tailwind 4 for UI (no component library).

## UI conventions
- Use the components in `app/components/ui` (Button, ButtonLink, Input, Textarea, Select, Field, Card, Badge, StatusBadge, Table, Tabs, EmptyState, Alert, Stat, PageHeader, CodeBlock). Add a component there before repeating markup.
- Light, neutral theme. Zinc greys for text, borders and surfaces, one brand accent (`brand-600`, blue #2563eb, with teal #0d9488 / #14b8a6 as the secondary accent) for primary actions and focus. Green (emerald), amber and red only for status, such as Running, Completed and positive lift.
- No gradients, glows, glassmorphism, emoji or decorative icons. The marketing site follows the same rule since the redesign (gradient headline, handwritten annotation and animated blobs were removed in PR B); its tokens and components are in `docs/plan.md` section 5 and `app/components/site`. Landing page numbers must be verified product facts; mock dashboards are wrapped in `SampleDataFrame` (label "Example data") and the homepage worked example is computed with lib/statistics and lib/sequential (tests/homeContent.test.ts). Product page claims (features, plans, limits) live in `lib/site/product.ts` and tests/productPages.test.ts checks plan notes against app/pricing/page.tsx; when a feature or plan changes, update both. Solutions pages (`lib/site/solutions.ts`) name a feature and plan per idea; tests/solutionsPages.test.ts checks them against the features data, so change all three together. The developers hub (`lib/site/developers.ts`) repeats code samples from `lib/docs/content`; tests/developersPage.test.ts fails when they drift, so when the SDK or API changes, update the docs and the hub together. The SDK docs live at `/docs/javascript-sdk` (slug `javascript-sdk`); `/docs/sdk` is only a 301 in next.config.js, and tests/docsShell.test.ts fails if any page or post links to it. `/docs/integrations` lists every integration with its plan; when one is added or a plan changes, update that page and the page it links to. Borders are 1px `zinc-200`; shadows are `shadow-xs`, `shadow-card` or `shadow-pop` only.
- Type: Inter (via next/font). Page titles `text-xl`/`text-2xl font-semibold`, body `text-sm`. Numbers in tables use `tabular-nums`.
- Spacing: stick to the 4px scale (1, 2, 3, 4, 6, 8, 12, 16, 24).
- App pages live under `app/(app)/` and get the sidebar shell from its layout. Check every page at 390px wide.
- Copy: plain and specific. No buzzwords, no em dashes, no invented customers, testimonials or stats.
- Target layout is a pnpm monorepo (see roadmap): `apps/web`, `packages/core`, `packages/stats`, `packages/sdk-js`. Until the migration is done, keep logic in `lib/` and keep it framework free.
- Bucketing, targeting and stats are pure functions with no I/O. They must give identical results in browser, server and any future SDK.
- Validate all API input with Zod (once added). Never trust client data.
- Database access goes through one data layer. No raw SQL strings in route handlers.
- Secrets come from environment variables only. Never commit keys, tokens or `.env` files.

## Coding standards
- Small, focused modules. Name things for what they do.
- No `any` unless unavoidable, with a comment explaining why.
- Handle errors explicitly; API routes return JSON errors with correct status codes.
- Every write endpoint must be authenticated and scoped to the caller's org and project.
- Keep the browser SDK small (target under 15 KB gzipped) and dependency free.
- Run `npm run lint` and a type check before committing.

## Testing
- Unit tests with Vitest for `lib/` or `packages/` logic. Stats code must be checked against reference values (for example scipy outputs).
- Bucketing changes need cross-implementation test vectors.
- UI and SDK flows get Playwright tests.
- Bug fixes include a test that fails before the fix.
- Note: no test runner exists yet. Adding Vitest is a Phase 1 M0 task.

## Commits and branches
- Conventional Commits: `type(scope): summary`, for example `feat(sdk): add anti-flicker snippet`. Types: feat, fix, docs, refactor, test, chore, perf, ci.
- Imperative mood, summary under 72 characters, body explains why when not obvious.
- One logical change per commit. Work on a branch, merge to `main` through a pull request.
- Do not push to `main` directly, force push shared branches, or rewrite published history.

## Writing style for docs
Plain language, short sentences, no em dashes, no filler.

## Product docs
- User-facing docs live at /docs, with content in `lib/docs/content/*.ts`. When a change affects behaviour, limits, the SDK or the API, update the matching docs page in the same PR. Never link to the GitHub README from the product. Public pages (docs, landing, pricing, roadmap) must not reveal internals: framework, database, hosting, env var names, rate limiter details, repo links or the admin console. Keep that in README and docs/*.md. Unbuilt features appear only as Coming soon rows on the pricing page, with no phase numbers (see Public roadmap below).


## Telemetry
Super-admin only at `/admin/telemetry`. Counters live in `telemetry_daily`; dashboard actions in `product_events` (hashed IP). Never expose visitor PII.

## Free plan rules
- Read plan limits only from `getOrgEntitlements()` (`limits.monthlyTests`, `limits.maxGoals`, `features.advanced_goals`), never from `lib/plans.ts` in routes.
- Free: 1 new test per calendar month (UTC), counted when the test is created, per account and per domain, in `free_test_usage`. Never decrement it. Use `checkNewTest` before and `recordNewTest` after creating a test, in any new create path.
- Free: 1 goal per test, a click on a CSS selector. Any new goal type or conversion path must check `advanced_goals` (see `goalPlanError`, `ingestTrack`, `/api/sdk/event`, `recordGoalHits`).
- Public copy: the Free card on /pricing shows three ticks and links to the comparison table (#compare), which lists every free limit in plain numbers with no footnotes. Never call Free "unlimited", "all features free" or a "free trial". Label paid-only features. `tests/publicCopyMatchesApp.test.ts` checks this.
- Duplicating a test is a create path: POST /api/experiments/[id]/duplicate calls `checkNewTest` and `recordNewTest` and re-checks plan limits on what it copies. Keep that for any future copy or import feature.
- Tests that are not about the free plan should put their org on a paid plan with `makePaid` (tests/helpers.ts), or clear the monthly counter with `resetFreeTestUsage`.
- Paid defaults (as on /pricing): Starter 250,000 tested visitors a month and 20 running tests; Growth 1,000,000 tested visitors and no running-test cap; both have 50 goals and 50 variations, with 3/5 and 10/15 projects and seats. Enterprise tested visitors and projects are custom (no default cap), with unlimited running tests and seats, still 50 goals and 50 variations. Published plans have no pageview cap. `organizations.monthly_visitor_limit` and `monthly_pageview_limit`: null is the plan default, -1 is unlimited. Keep `tests/publicCopyMatchesApp.test.ts` and `tests/paidPlanLimits.test.ts` in sync when those numbers change.


## Sign-up protection
- Bot check: Cloudflare Turnstile runs on /signin before the Google button is enabled. Env vars: `NEXT_PUBLIC_TURNSTILE_SITE_KEY` (widget, public) and `TURNSTILE_SECRET_KEY` (server only). Both must be set to turn it on; with either missing the check is skipped and one warning is logged per process.
- Flow (`lib/turnstile.ts`): the widget token goes to POST /api/auth/turnstile, which checks it with Cloudflare siteverify (with the client IP) and sets the `fat_bot_pass` cookie (HttpOnly, path /api/auth, 10 minutes, HMAC signed with NEXTAUTH_SECRET). The auth route wrapper refuses POST /api/auth/signin/<provider> without a valid pass, and the NextAuth signIn callback refuses to create a new account without it (request info reaches the callback through `lib/authRequest.ts`). Refusals land on /signin?error=BotCheck.
- Sign-up caps (`lib/signupLimits.ts`): new accounts per client IP and per range (/24 IPv4, /48 IPv6) per UTC day, defaults 3 and 10, counted in `signup_counts` (shared by every server, atomic upsert, a refused attempt gives its slot back). Admins change them on /admin/abuse (stored in `platform_settings`). Refusals go to `abuse_events` and /signin?error=SignupLimit. IPs and ranges are stored only as `hashIp` hashes (salt TELEMETRY_IP_SALT, else NEXTAUTH_SECRET); `users.signup_ip_hash` keeps the sign-up IP hash. Retention: counters 30 days, abuse_events 180 days. Unknown IPs and platform admins are not limited.
- Site verification for Free (`lib/siteVerification.ts`): a free test starts (or resumes, manual or scheduled, via `checkStart`) only when a registered domain with the test's registrable domain has `project_domains.last_seen_at` within 7 days. `checkSdkOrigin` records it on every passing SDK request (at most one write per host per 5 minutes). Local test pages, paid plans, special friends and platform admins skip it (`freeTierRules`). UI: SiteVerifyCard on the experiment page with Re-check (GET /api/experiments/[id]/site-check). Origin headers can be forged by a script, so this proves the snippet is live only for normal browser traffic; the domain ledger stays the hard limit.
- Duplicate flags (`lib/duplicates.ts`, /admin/duplicates): orgs grouped when members share a phone (normalised to E.164 with libphonenumber, masked in the UI), `users.signup_ip_hash`, or a registrable domain; only groups of 2 or more orgs. Nothing is automatic. One-click Suspend/Unsuspend posts to /api/admin/orgs/[id]/suspension (`lib/suspension.ts`), which writes the audit log (admin:suspend / admin:reactivate) and abuse_events (org_suspended / org_unsuspended); the tenant PATCH route also writes the abuse entry. Enforcement already lives in requestAuth (SDK and secret keys 403, so the SDK serves nothing) and app/(app)/layout.tsx (suspended notice); other instances see it within the 45 s config cache.
- Only the widget is used. The domain is not behind the Cloudflare proxy and no DNS change is needed. Keep these names out of public docs.

## Blog posts from the content store
- Before replacing a live post with a store copy, diff the two. Store copies can miss edits made only in the repo (for example the links from posts 02 and 03 to post 04); keep those and apply only the requested change.
- Check product claims in a new post against the code (lib/plans.ts, sdk-src/sdk.js, lib/docs/content) and add tests/blogPostNN.test.ts. Date pins on older posts use >= so later updates do not break them.
- Store copies can also predate repo-side content changes (for example PR #110 removed roadmap and phase wording from posts 01, 04 and 05). Apply only the requested edits to the live file; never bring back /roadmap links or phase wording from a store copy.
- When a post reports simulation results, re-run them with a few seeds before publishing, and check any sentence about how the product's test is tuned against lib/sequential.ts (TAU_RELATIVE, SEQUENTIAL_MIN_VISITORS). Do not publish the internal tuning values.
- When a post describes what the results screen shows, check app/(app)/experiments/[id]/page.tsx and LiveStats.tsx, not only the docs: the goals table shows an uplift interval that the docs do not mention.
- Posts must not carry an in-body byline line (By Imraan, freeabtest.com. Published ... / Updated ... / Sources checked ...). The post header shows author and date. Strip it from store copies before publishing; tests/blogByline.test.ts fails otherwise.

## Experiment management
- Archived tests (`experiments.archived_at` set) must never be served. Any new SDK, server or schedule path that reads tests must skip them, like `getRunningConfig`, `getRolloutConfig`, `getDueSchedules`, `rolloutVariation`, `checkEvent` and `previewBlocker`. Archive is a flag, not a status: the status stays paused or completed.
- Per-test history (GET /api/experiments/[id]/history) uses the `audit_log` feature and the plan retention window, the same as the org audit log. Every experiment change must write `db.audit` with `entity: 'experiment'` and the experiment id so it shows there.
- Tags are cleaned with `tagsSchema` (lower case, deduped, max 10) and stored as JSON; read them with `parseTags`.


## AI features
- Everything AI goes through lib/ai/service.ts: `prepareAi(orgId)` checks configuration, plan (`ai` feature), key and the per-org rate limit, then `askText`. Do not call providers directly from routes.
- Never log, return or audit a key. Only status codes and error codes are logged. Keys are decrypted only inside `prepareAi`.
- Page text sent to a provider is wrapped in `<data>` and the system prompt says to treat it as information only. Server-side page fetches must use lib/ai/pageText.ts (SSRF checks and DNS pinning).
- Any AI text about results must agree with `verdictOf`; keep `agreesWithVerdict` in the path.
- Public copy may say "your own key" and list providers, but never the encryption details or env var name. Images are not built: do not claim them.
- Tests stub `fetch` with `vi.stubGlobal`; never call a real provider in tests.

## Legal and billing copy
- Operator details live in `lib/legal.ts`. Keep `LEGAL.address` worded exactly as the Razorpay KYC record. The public Contact page shows `LEGAL.contactPhone` (+91 9964 180587) and hello@freeabtest.com. Governing law is India, courts of Bengaluru.
- Public policy pages: /about, /contact, /legal/terms, /legal/privacy, /legal/dpa, /legal/cookies, /legal/refunds, /legal/delivery and /security. Link them from the footer and `app/sitemap.ts`.
- Do not claim paid checkout is live until it ships. Billing terms in the Terms (section 2) and /legal/refunds already state: no mid-cycle refunds; access continues until the period ends; cancellations and downgrades take effect at period end (same as the pricing FAQ).
- When the Terms or Privacy Policy change in substance, bump `LEGAL_VERSION` and `LEGAL_UPDATED`. Keep `tests/policyPages.test.ts` in sync if the entity, address, phone or refund rules change.

## Billing
- List prices are in lib/billing/config.ts (PLAN_PRICES_USD): Starter $20/month and $200/year, Growth $50/month and $500/year. Yearly is two months free. Keep the pricing page (cards, FAQ, metadata), Settings Billing, scripts/paypal-setup.mjs and public blog copy in sync when these change.
- All payment code lives in lib/billing. Routes and pages never call a provider directly. A new provider (Razorpay INR next) adds an adapter that returns a ProviderSubscription (lib/billing/provider.ts) and reuses applySubscription.
- Never grant a plan from the browser or a webhook body. Always re-read the subscription from the provider (syncPayPalSubscription). Webhooks are verified with the raw body and recorded by event id in billing_webhook_events before they are applied.
- Billing writes organizations.plan, plan_ends_at, scheduled_plan, scheduled_period and scheduled_plan_at only. Do not touch plan_override, special-friend allowances or platform admin rules from billing code; they keep winning in lib/entitlements.ts.
- Upgrades apply immediately (PayPal revise where supported, else new subscription then cancel old once the new one is active). Downgrades and in-app cancellations take effect at the end of the paid period (no mid-cycle refunds).
- Billing stays hidden until paypalConfig() returns a config, and while PAYPAL_API_BASE is sandbox it stays restricted to platform admins and BILLING_TEST_EMAILS via canUseBillingCheckout / canSessionCheckout. Billing routes use the Node runtime.
- Public copy must not say checkout is live until the variables are set in production. Never import next-auth in public pages scanned by tests/publicContent.test.ts (use lib/billing/access.ts). Keep PayPal variable names out of public pages and docs. Keep tests/billing.test.ts in sync.

## Public roadmap
- There is no public roadmap. Do not add /roadmap links, phase numbers or "see roadmap" wording to public pages, docs or blog posts. Planned features appear only as Coming soon rows on the pricing page. Keep docs/roadmap.md as the internal plan (step 3 of Required on every change still applies).
