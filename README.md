# A/B Testing Platform

A self-hosted, cost-effective A/B testing platform supporting unlimited A/B/n variations. Designed to run on Vercel with minimal operational cost while maintaining performance, accuracy, and full data ownership.

## Features

- ✅ Multiple A/B/n variations per experiment
- ✅ Deterministic user-to-variant assignment
- ✅ Statistical significance testing with confidence intervals
- ✅ Real-time experiment management dashboard
- ✅ Conversion and event tracking
- ✅ Lightweight client SDK
- ✅ Full data ownership and control
- ✅ Cost-effective (designed for Vercel + Cloudflare free tiers)

## Architecture

- **Frontend**: Next.js 16 with App Router
- **Styling**: Tailwind CSS 4
- **Hosting**: Vercel (recommended)
- **Database**: SQLite via libSQL and Drizzle ORM. Local file in development, Turso (hosted libSQL) in production
- **Edge Compute**: Cloudflare Workers (optional)
- **Client SDK**: Vanilla JavaScript

## Getting Started

### Prerequisites

- Node.js 20+
- npm or yarn

### Installation

1. Clone the repository
2. Install dependencies:

```bash
npm install
```

3. Copy `.env.example` to `.env.local` and fill in the values (Google OAuth client, NEXTAUTH_SECRET).
   The database defaults to `file:./data/cro.db` and migrations run automatically on first request.
   You can also run them yourself with `npm run db:migrate`.

4. Run the development server:

```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000) to access the dashboard

## Usage

### Creating an Experiment

1. Navigate to the dashboard
2. Click "Create Experiment"
3. Fill in experiment details:
   - Name and description
   - Traffic allocation (percentage of users to include)
   - Define variations with weights (must sum to 100%)
   - Mark one variation as the control
4. Save as draft
5. Start the experiment when ready

### Implementing Client-Side Tracking

Add the SDK to your website:

```html
<script src="https://your-domain.com/sdk.js"></script>
<script>
  // Initialize SDK. Create an SDK key under API Keys in the dashboard.
  ABTest.init({
    apiUrl: 'https://your-domain.com',
    apiKey: 'cro_pk_prod_...',
    userId: 'optional-user-id' // Will be auto-generated if not provided
  });

  // Get variation assignment
  ABTest.getVariation('exp_123456').then(function(variation) {
    if (variation.assigned) {
      console.log('Assigned to:', variation.variation_name);
      
      // Apply your variation logic
      if (variation.variation_name === 'Variation A') {
        // Show variation A
      } else {
        // Show control
      }
    }
  });

  // Track conversion events
  document.getElementById('checkout-button').addEventListener('click', function() {
    ABTest.track('exp_123456', 'conversion', 'checkout');
  });
</script>
```

## API Endpoints

### Experiments

- `GET /api/experiments` - List all experiments
- `POST /api/experiments` - Create a new experiment
- `GET /api/experiments/[id]` - Get experiment details
- `PATCH /api/experiments/[id]` - Update experiment
- `DELETE /api/experiments/[id]` - Delete experiment (draft only)
- `GET /api/experiments/[id]/results` - Get experiment results with statistics

### Assignment & Tracking

- `POST /api/assign` - Get or create user assignment
- `POST /api/track` - Track page view or conversion event

## Data Model

### Experiment
- Stores experiment metadata (name, description, status, traffic allocation)
- Status transitions: draft → running → paused/completed

### Variation
- Defines test variations with weights
- One variation must be marked as control

### Assignment
- Immutable record of user-to-variation assignments
- Ensures consistent experience across sessions

### Event
- Append-only event log (page views, conversions)
- Used for statistical analysis

## Statistics Engine

The platform uses frequentist statistical methods:

- **Z-test** for comparing conversion rates
- **Wilson score interval** for confidence intervals
- **Two-tailed significance testing** at 95% confidence level
- Minimum sample size requirement: 100 users per variation

## Development

### Scripts

- `npm run dev`: development server
- `npm run build`: production build
- `npm run lint`: ESLint
- `npm run typecheck`: TypeScript check
- `npm test`: unit and integration tests (Vitest)
- `npm run db:generate`: create a migration after editing `lib/db/schema.ts`
- `npm run db:migrate`: apply migrations to `DATABASE_URL`

### Project Structure

```
├── app/
│   ├── api/              # API routes (assign, track, experiments, keys)
│   ├── dashboard/        # Experiment list
│   ├── experiments/      # Experiment pages
│   └── settings/keys/    # API key management
├── lib/
│   ├── db/               # Drizzle schema, client, data access
│   ├── assignment.ts     # Bucketing
│   ├── statistics.ts     # Statistics
│   ├── apiKeys.ts        # Key generation and hashing
│   ├── rateLimit.ts      # Rate limiter
│   └── requestAuth.ts    # Session, secret key and SDK key auth
├── drizzle/              # SQL migrations
├── tests/                # Vitest tests
├── docs/                 # Roadmap, agent guide, changelog, current state
└── public/
    └── sdk.js            # Client SDK
```

### Data model

Each user gets an organization on first sign-in, with a default project and three environments
(dev, staging, prod). API keys belong to an environment. SDK keys (`cro_pk_...`) authenticate
`/api/assign` and `/api/track`. Secret keys (`cro_sk_...`) can read the management API with
`Authorization: Bearer`. Only key hashes are stored.

## Deployment

### Vercel Deployment

1. Push your code to GitHub
2. Import project in Vercel
3. Configure environment variables (if needed)
4. Deploy

### Production database (Turso)

1. Create a Turso database: `turso db create cro`
2. Get the URL and a token: `turso db show cro --url` and `turso db tokens create cro`
3. Set `DATABASE_URL` (libsql://...) and `DATABASE_AUTH_TOKEN` in Vercel
4. Run `npm run db:migrate` against it, or leave auto migration on

A local SQLite file does not persist on Vercel, so a hosted database is required there.
