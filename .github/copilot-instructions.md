# CRO Platform - AI Coding Agent Instructions

## Project Overview
Self-hosted A/B testing platform built with Next.js 16 (App Router), targeting Vercel + Cloudflare D1 deployment. Emphasizes cost-efficiency, deterministic user assignment, and statistical rigor.

## Architecture & Data Flow

### Core Components
- **Next.js API Routes** ([app/api/](app/api/)): RESTful endpoints for experiment CRUD, assignment, and event tracking
- **Assignment Engine** ([lib/assignment.ts](lib/assignment.ts)): Deterministic SHA-256 hashing ensures consistent user→variation mapping
- **Statistics Engine** ([lib/statistics.ts](lib/statistics.ts)): Wilson score confidence intervals + two-proportion z-tests for significance
- **Database Layer** ([lib/db.ts](lib/db.ts)): Abstraction supporting in-memory dev DB and production Cloudflare D1 (SQLite-compatible)
- **Client SDK** ([public/ab-sdk.js](public/ab-sdk.js)): Vanilla JS snippet for websites; handles localStorage caching of assignments

### Critical Data Flow
1. **Assignment Request** → `/api/assign` checks existing assignment → if none, runs deterministic hash (userId + experimentId) → compares to traffic allocation & variation weights → stores immutable assignment → returns variation
2. **Event Tracking** → `/api/track` appends events to append-only events table → aggregated for statistics calculation
3. **Results** → `/api/experiments/[id]/results` queries events grouped by variation_id → calculates conversion rates → runs statistical tests vs control

## Database Schema Principles
- **Immutability**: `assignments` table never updates (UNIQUE constraint on experiment_id + user_id)
- **Append-Only**: `events` table only inserts (no updates/deletes) for audit trail
- **Constraints**: Strict CHECK constraints enforce valid ranges (traffic_allocation 0-100, variation weights 0-100)
- See [lib/schema.sql](lib/schema.sql) for full DDL

## Development Workflow

### Running Locally
```bash
npm run dev  # Starts on localhost:3000 with TURBOPACK=0 (disabled for compatibility)
```
- In-memory database used in dev (no persistence between restarts)
- Production will use Cloudflare D1 (requires wrangler setup - not yet configured)

### Key Commands
- `npm run build` - Production build for Vercel
- `npm run lint` - ESLint validation

### Testing Client SDK
Open [public/demo.html](public/demo.html) in browser (served at `http://localhost:3000/demo.html`)

## Code Conventions

### ID Generation
All IDs use `generateId(prefix)` from [lib/assignment.ts](lib/assignment.ts):
- Experiments: `exp_<timestamp>_<random>`
- Variations: `var_<timestamp>_<random>`
- Assignments: `asn_<timestamp>_<random>`

### API Response Patterns
```typescript
// Success: Return data directly
return NextResponse.json({ experiments });

// Validation error: 400 with error key
return NextResponse.json({ error: 'Weights must sum to 100' }, { status: 400 });

// Server error: 500 + console.error
console.error('Failed to create:', error);
return NextResponse.json({ error: 'Failed to create' }, { status: 500 });
```

### TypeScript Patterns
- All DB types defined in [lib/types.ts](lib/types.ts)
- API request/response interfaces separate from DB schemas
- Use `ExperimentStatus` union type ('draft' | 'running' | 'paused' | 'completed')

### UI Components
- DaisyUI components ([tailwind.config.js](tailwind.config.js) custom dark theme)
- Server components by default (Next.js App Router)
- Navbar imported from [app/components/Navbar.tsx](app/components/Navbar.tsx)
- Use `data-theme="dark"` in layout (set in [app/layout.tsx](app/layout.tsx))

## Critical Business Rules

### Variation Weight Validation
**Always enforce**: Total variation weights = 100% using `validateVariationWeights()` before creating experiments

### Control Variation
**Exactly one** variation must have `is_control: true` per experiment (enforced in POST /api/experiments)

### Deterministic Assignment
**Never randomize** user assignments - always use `hashUserToVariation(userId, experimentId)` for consistency across page loads/sessions

### Traffic Allocation
Two-stage assignment:
1. Hash user with `traffic:${experimentId}` → compare to traffic_allocation threshold
2. If included, hash with `experimentId` → assign to variation by cumulative weight

## Statistical Significance
- Use Wilson score for confidence intervals (more accurate than normal approximation for small samples)
- Default 95% confidence (z=1.96)
- Compare variations to control using two-proportion z-test
- See [lib/statistics.ts](lib/statistics.ts) `compareVariations()` function

## Gotchas & Edge Cases

### Database Abstraction
When adding DB queries, implement in **both** `InMemoryDatabase` and update the interface for D1 compatibility (query strings are raw SQL)

### SDK Client-Side Caching
SDK caches assignments in `localStorage` key `ab_test_assignments` - clear this when testing different assignments for same user

### Next.js Turbopack
Disabled via `TURBOPACK=0` in dev script due to compatibility issues - keep this until resolved

### API Base URL
Server components use `process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'` for fetch calls - set env var for production

## Future Migration Notes
- Currently in-memory DB; plan states Cloudflare D1 for production (see [plan.md](plan.md) lines 68-71)
- Cloudflare Workers for edge assignment planned but not implemented
- NextAuth.js mentioned in plan but not yet integrated
