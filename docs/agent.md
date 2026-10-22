# Agent and Developer Guide

Read this before changing anything in this repo. It applies to people and AI agents alike.

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
- No gradients, glows, glassmorphism, emoji or decorative icons. Exception: the marketing landing page (`app/page.tsx`) may use the gradient headline text, the handwritten annotation and the slow animated background blobs (`.blob` in globals.css: transform only, 15 to 30s loops, off under prefers-reduced-motion). Landing page numbers must be verified product facts; mock dashboards are labelled "Example data". Borders are 1px `zinc-200`; shadows are `shadow-xs`, `shadow-card` or `shadow-pop` only.
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
- User-facing docs live at /docs, with content in `lib/docs/content/*.ts`. When a change affects behaviour, limits, the SDK or the API, update the matching docs page in the same PR. Never link to the GitHub README from the product. Public pages (docs, landing, pricing, roadmap) must not reveal internals: framework, database, hosting, env var names, rate limiter details, repo links or the admin console. Keep that in README and docs/*.md. Mark unbuilt features as Coming later with their phase.


## Telemetry
Super-admin only at `/admin/telemetry`. Counters live in `telemetry_daily`; dashboard actions in `product_events` (hashed IP). Never expose visitor PII.

## Free plan rules
- Read plan limits only from `getOrgEntitlements()` (`limits.monthlyTests`, `limits.maxGoals`, `features.advanced_goals`), never from `lib/plans.ts` in routes.
- Free: 1 new test per calendar month (UTC), counted when the test is created, per account and per domain, in `free_test_usage`. Never decrement it. Use `checkNewTest` before and `recordNewTest` after creating a test, in any new create path.
- Free: 1 goal per test, a click on a CSS selector. Any new goal type or conversion path must check `advanced_goals` (see `goalPlanError`, `ingestTrack`, `/api/sdk/event`, `recordGoalHits`).
- Public copy: the Free card on /pricing shows three ticks and links to the comparison table (#compare), which lists every free limit in plain numbers with no footnotes. Never call Free "unlimited", "all features free" or a "free trial". Label paid-only features. `tests/publicCopyMatchesApp.test.ts` checks this.
- Tests that are not about the free plan should put their org on a paid plan with `makePaid` (tests/helpers.ts), or clear the monthly counter with `resetFreeTestUsage`.


## Sign-up protection
- Bot check: Cloudflare Turnstile runs on /signin before the Google button is enabled. Env vars: `NEXT_PUBLIC_TURNSTILE_SITE_KEY` (widget, public) and `TURNSTILE_SECRET_KEY` (server only). Both must be set to turn it on; with either missing the check is skipped and one warning is logged per process.
- Flow (`lib/turnstile.ts`): the widget token goes to POST /api/auth/turnstile, which checks it with Cloudflare siteverify (with the client IP) and sets the `fat_bot_pass` cookie (HttpOnly, path /api/auth, 10 minutes, HMAC signed with NEXTAUTH_SECRET). The auth route wrapper refuses POST /api/auth/signin/<provider> without a valid pass, and the NextAuth signIn callback refuses to create a new account without it (request info reaches the callback through `lib/authRequest.ts`). Refusals land on /signin?error=BotCheck.
- Sign-up caps (`lib/signupLimits.ts`): new accounts per client IP and per range (/24 IPv4, /48 IPv6) per UTC day, defaults 3 and 10, counted in `signup_counts` (shared by every server, atomic upsert, a refused attempt gives its slot back). Admins change them on /admin/abuse (stored in `platform_settings`). Refusals go to `abuse_events` and /signin?error=SignupLimit. IPs and ranges are stored only as `hashIp` hashes (salt TELEMETRY_IP_SALT, else NEXTAUTH_SECRET); `users.signup_ip_hash` keeps the sign-up IP hash. Retention: counters 30 days, abuse_events 180 days. Unknown IPs and platform admins are not limited.
- Site verification for Free (`lib/siteVerification.ts`): a free test starts (or resumes, manual or scheduled, via `checkStart`) only when a registered domain with the test's registrable domain has `project_domains.last_seen_at` within 7 days. `checkSdkOrigin` records it on every passing SDK request (at most one write per host per 5 minutes). Local test pages, paid plans, special friends and platform admins skip it (`freeTierRules`). UI: SiteVerifyCard on the experiment page with Re-check (GET /api/experiments/[id]/site-check). Origin headers can be forged by a script, so this proves the snippet is live only for normal browser traffic; the domain ledger stays the hard limit.
- Duplicate flags (`lib/duplicates.ts`, /admin/duplicates): orgs grouped when members share a phone (normalised to E.164 with libphonenumber, masked in the UI), `users.signup_ip_hash`, or a registrable domain; only groups of 2 or more orgs. Nothing is automatic. One-click Suspend/Unsuspend posts to /api/admin/orgs/[id]/suspension (`lib/suspension.ts`), which writes the audit log (admin:suspend / admin:reactivate) and abuse_events (org_suspended / org_unsuspended); the tenant PATCH route also writes the abuse entry. Enforcement already lives in requestAuth (SDK and secret keys 403, so the SDK serves nothing) and app/(app)/layout.tsx (suspended notice); other instances see it within the 45 s config cache.
- Only the widget is used. The domain is not behind the Cloudflare proxy and no DNS change is needed. Keep these names out of public docs.
