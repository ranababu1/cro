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
- Light, neutral theme. Zinc greys for text, borders and surfaces, one brand accent (`brand-600`, indigo) for primary actions and focus. Green, amber and red only for status.
- No gradients, glows, glassmorphism, emoji or decorative icons. Borders are 1px `zinc-200`; shadows are `shadow-xs`, `shadow-card` or `shadow-pop` only.
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
