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
- **Database**: In-memory (development) / Cloudflare D1 (production)
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

3. Run the development server:

```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) to access the dashboard

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
<script src="https://your-domain.com/ab-sdk.js"></script>
<script>
  // Initialize SDK
  ABTest.init({
    apiUrl: 'https://your-domain.com',
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

### Project Structure

```
├── app/
│   ├── api/              # API routes
│   ├── experiments/      # Experiment pages
│   ├── page.tsx          # Dashboard
│   └── layout.tsx        # Root layout
├── lib/
│   ├── types.ts          # TypeScript types
│   ├── db.ts             # Database operations
│   ├── assignment.ts     # Assignment engine
│   ├── statistics.ts     # Statistical calculations
│   └── schema.sql        # Database schema
└── public/
    └── ab-sdk.js         # Client SDK
```

## Deployment

### Vercel Deployment

1. Push your code to GitHub
2. Import project in Vercel
3. Configure environment variables (if needed)
4. Deploy

### Cloudflare D1 Setup (Production Database)

1. Create a D1 database in Cloudflare dashboard
2. Run the schema from `lib/schema.sql`
3. Configure D1 binding in your Workers
4. Update database connection in `lib/db.ts`

## Cost Optimization

The platform is designed to run within free tiers:

- **Vercel**: Free tier supports ~100K requests/month
- **Cloudflare Workers**: 100K requests/day on free tier
- **Cloudflare D1**: 5GB storage, 5M reads/day on free tier

Expected cost at 100K MAU: < $20/month

## Roadmap

- [ ] Cloudflare D1 production database integration
- [ ] Cloudflare Workers edge deployment
- [ ] Multi-armed bandit optimization
- [ ] Advanced user segmentation
- [ ] Data export (CSV/JSON)
- [ ] API authentication
- [ ] Team collaboration features

## License

MIT License