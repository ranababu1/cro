# Current State

As of 2026-10-14 (IST), commit 5c9fc1d on main. Early prototype, not production ready.

## Stack
- Next.js 16 App Router, React 19, TypeScript, Tailwind 4, DaisyUI.
- Auth: next-auth v4, Google provider only, JWT sessions (`lib/auth.ts`).
- Database: in-memory store in `lib/db.ts` that pattern-matches SQL strings. Data is lost on restart. `lib/schema.sql` (SQLite/D1) exists but is not used.
- No tests, no CI, no deployment config. README targets Vercel and Cloudflare D1.

## Features that work
- Google sign-in; experiments owned by the signed-in user.
- Create experiments with name, description, traffic allocation and weighted variations (A/B/n), one marked as control.
- Statuses: draft, running, paused, completed.
- Deterministic assignment (`lib/assignment.ts`): SHA-256 of experiment and user ID, separate traffic hash, weighted buckets. Served by `POST /api/assign`, which stores assignments.
- Event tracking via `POST /api/track` (page_view and conversion only).
- Results (`/api/experiments/[id]/results`): conversion rate, two-proportion z-test, Wilson confidence intervals (`lib/statistics.ts`).
- Pages: dashboard, new experiment, experiment detail. Demo page `public/demo.html`.
- Browser SDK: two overlapping vanilla JS files, `public/sdk.js` and `public/ab-sdk.js`, with localStorage visitor ID.

## Known gaps
- No persistence, orgs, projects, environments or API keys.
- Track and assign endpoints are unauthenticated, with no rate limit or CORS policy.
- SDK makes a server call per visitor and has no anti-flicker handling.
- No targeting, goal definitions, revenue metrics, SRM check or sample size tools.
- Last commit is marked "wip".

## Next
See `docs/roadmap.md`, Phase 1 milestone M0.
