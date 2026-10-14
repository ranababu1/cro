# CRO Platform: Coding Agent Instructions

Read `docs/agent.md` first. It is the source of truth for conventions, testing and commit style, and it
requires every change to update `docs/changelog.md` and `docs/currentstate.md`.

Quick orientation:
- Product plan: `docs/roadmap.md`. What exists today: `docs/currentstate.md`.
- Database: Drizzle ORM on libSQL/SQLite. Schema in `lib/db/schema.ts`, data access in `lib/db/index.ts`,
  migrations in `drizzle/` (create with `npm run db:generate`). No raw SQL in route handlers.
- Auth: `lib/requestAuth.ts`. Dashboard and management routes use a session or a secret key
  (`Authorization: Bearer cro_sk_...`). SDK routes (`/api/assign`, `/api/track`) need an SDK key
  (`X-API-Key: cro_pk_...`) and are rate limited.
- Every query must be scoped to the caller's projects (`lib/access.ts`).
- Bucketing (`lib/assignment.ts`) and stats (`lib/statistics.ts`) are pure functions with tests in `tests/`.
- Before committing: `npm run lint && npm run typecheck && npm test && npm run build`.
