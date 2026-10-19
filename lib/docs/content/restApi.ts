import type { DocPage } from '../types';

export const restApi: DocPage = {
    slug: 'rest-api',
    title: 'REST API reference',
    description: 'Authentication, every endpoint, request and response shapes, errors and examples.',
    group: 'Reference',
    blocks: [
        { type: 'p', text: 'All endpoints live under the base URL shown on the experiment **Setup** tab, written here as `https://YOUR-HOST/api/...`. Requests and responses are JSON. Errors always have the shape `{ "error": "message" }`.' },
        { type: 'h2', text: 'Authentication' },
        { type: 'table', head: ['Used for', 'How to authenticate'], rows: [
            ['SDK endpoints (`/api/assign`, `/api/track`)', 'An SDK key in the `X-API-Key` header (or a `?key=` query parameter). Secret keys are rejected here.'],
            ['Management endpoints (`/api/experiments...`)', 'A signed-in dashboard session, or a secret key: `Authorization: Bearer cro_sk_...`. A secret key only sees experiments in its own project.'],
            ['Key management (`/api/keys...`)', 'Dashboard session only.'],
        ] },
        { type: 'callout', tone: 'warning', title: 'Keep secret keys on the server', text: 'A secret key can read and change every experiment in its project. Store it in an environment variable, never in client code or a repository.' },
        { type: 'h2', text: 'Errors' },
        { type: 'table', head: ['Status', 'Meaning'], rows: [
            ['400', 'Invalid input. The message names the field, for example `variations: Experiment must have at least 2 variations`.'],
            ['401', 'Missing, malformed, unknown or revoked key, or not signed in.'],
            ['403', 'The organization is suspended, a plan limit was reached, or the action is not allowed for this kind of caller.'],
            ['404', 'Not found. Experiments in other projects also return 404.'],
            ['429', 'Rate limit exceeded: per key and client IP on SDK endpoints, and 120 requests a minute per secret key on management endpoints. A `Retry-After` header says how many seconds to wait.'],
        ] },
        { type: 'h2', text: 'SDK endpoints' },
        { type: 'p', text: 'These accept cross-origin requests from any site (CORS `*`) and answer `OPTIONS` preflights. They are rate limited per key and client IP.' },
        { type: 'h3', text: 'POST /api/assign', id: 'assign' },
        { type: 'p', text: 'Returns the visitor\'s variation, creating the assignment if needed. The data is recorded in the environment of the key.' },
        { type: 'code', label: 'curl', code: `curl -X POST https://YOUR-HOST/api/assign \\
  -H 'Content-Type: application/json' \\
  -H 'X-API-Key: cro_pk_prod_...' \\
  -d '{"experiment_id": "exp_123", "user_id": "user_42"}'` },
        { type: 'code', label: '200 response', code: `{
  "experiment_id": "exp_123",
  "variation_id": "var_456",
  "variation_name": "Variant B",
  "variation_url": "https://example.com/b",
  "assigned": true
}` },
        { type: 'p', text: '`assigned` is `false` when the experiment is not running, the visitor is outside the traffic allocation, or the organization reached its monthly visitor limit (then `reason` is `"quota_exceeded"`). Visitors who already have an assignment keep it while the experiment runs, even after the limit is reached.' },
        { type: 'h3', text: 'POST /api/track', id: 'track' },
        { type: 'table', head: ['Field', 'Type', 'Notes'], rows: [
            ['`experiment_id`', 'string', 'Required.'],
            ['`variation_id`', 'string', 'Required. Must belong to the experiment.'],
            ['`user_id`', 'string', 'Required. 1 to 200 printable ASCII characters.'],
            ['`event_type`', '`page_view` or `conversion`', 'Required.'],
            ['`event_name`', 'string', 'Optional, up to 200 characters.'],
            ['`metadata`', 'object', 'Optional, under 4096 bytes as JSON.'],
        ] },
        { type: 'code', label: 'curl', code: `curl -X POST https://YOUR-HOST/api/track \\
  -H 'Content-Type: application/json' \\
  -H 'X-API-Key: cro_pk_prod_...' \\
  -d '{"experiment_id":"exp_123","variation_id":"var_456","user_id":"user_42","event_type":"conversion","event_name":"purchase"}'` },
        { type: 'p', text: 'Returns `201` with `{ "success": true }`.' },
        { type: 'h2', text: 'Experiments' },
        { type: 'h3', text: 'GET /api/experiments', id: 'list-experiments' },
        { type: 'p', text: 'Lists experiments you can access: `{ "experiments": [...] }`.' },
        { type: 'code', label: 'curl', code: `curl https://YOUR-HOST/api/experiments \\
  -H 'Authorization: Bearer cro_sk_prod_...'` },
        { type: 'h3', text: 'POST /api/experiments', id: 'create-experiment' },
        { type: 'p', text: 'Creates a draft experiment. Weights must add up to 100 and exactly one variation must be the control. Requires a dashboard session: creating experiments with a secret key returns 403 for now.' },
        { type: 'code', label: 'Request body', code: `{
  "name": "Pricing page headline",
  "description": "A benefit-led headline will increase plan selections.",
  "project_id": "prj_...",          // optional, defaults to the selected project
  "traffic_allocation": 100,        // optional, 0 to 100, default 100
  "variations": [
    { "name": "Control",   "weight": 50, "is_control": true },
    { "name": "Variant B", "weight": 50, "is_control": false, "url": "https://example.com/b" }
  ]
}` },
        { type: 'p', text: 'Returns `201` with `{ "experiment": {...}, "variations": [...] }`.' },
        { type: 'h3', text: 'GET /api/experiments/{id}', id: 'get-experiment' },
        { type: 'p', text: 'Returns `{ "experiment": {...}, "variations": [...] }`.' },
        { type: 'h3', text: 'PATCH /api/experiments/{id}', id: 'update-experiment' },
        { type: 'p', text: 'Updates `name`, `description`, `traffic_allocation` or `status`. Any other field is rejected. Status changes must follow the allowed transitions (draft to running, running to paused or completed, paused to running or completed).' },
        { type: 'code', label: 'Start an experiment', code: `curl -X PATCH https://YOUR-HOST/api/experiments/exp_123 \\
  -H 'Authorization: Bearer cro_sk_prod_...' \\
  -H 'Content-Type: application/json' \\
  -d '{"status": "running"}'` },
        { type: 'h3', text: 'DELETE /api/experiments/{id}', id: 'delete-experiment' },
        { type: 'p', text: 'Deletes a draft. Any other status returns 400.' },
        { type: 'h3', text: 'POST /api/experiments/{id}/variations/{variationId}/preview', id: 'preview-link' },
        { type: 'p', text: 'Creates a QA preview link for one variation, for example to check every version in an automated browser test. Returns `{ "url": "...", "expires_at": "..." }`. The link opens the control page as that variation for 7 days and is never counted in results. A completed test returns 400.' },
        { type: 'h3', text: 'GET /api/experiments/{id}/results', id: 'results' },
        { type: 'p', text: 'Optional query parameter `environment=dev|staging|prod`. Without it, all environments are combined.' },
        { type: 'code', label: '200 response', code: `{
  "experiment_id": "exp_123",
  "experiment_name": "Pricing page headline",
  "status": "running",
  "sample_size": 4800,
  "winner": "var_456",               // present only when a variant is significantly better on the sequential test
  "variations": [
    {
      "variation_id": "var_111", "variation_name": "Control", "is_control": true,
      "total_users": 2400, "conversions": 120, "conversion_rate": 0.05,
      "confidence_interval": { "lower": 0.042, "upper": 0.059 }
    },
    {
      "variation_id": "var_456", "variation_name": "Variant B", "is_control": false,
      "total_users": 2400, "conversions": 175, "conversion_rate": 0.0729,
      "confidence_interval": { "lower": 0.063, "upper": 0.084 },
      "chance_to_beat_control": 0.9995, "sequential_p_value": 0.047, "sequential_significant": true
    }
  ],
  "sequential": {                    // peeking-safe verdict; "winner" follows it
    "method": "msprt", "alpha": 0.05, "threshold": 0.05, "comparisons": 1,
    "best_variation_id": "var_456", "p_value": 0.047, "is_significant": true, "control_ahead": false
  },
  "statistical_significance": {
    "is_significant": true, "p_value": 0.0009, "confidence_level": 0.95, "z_score": -3.31
  }
}` },
        { type: 'p', text: '`statistical_significance` is a fixed-sample z-test of the best variant, valid only if you look once at a sample size planned in advance. `z_score` is computed as control minus variant, so a negative value means the variant converts better. `sequential` and the per-variation `sequential_p_value` stay valid however often you check; `threshold` is 0.05 divided by the number of variants compared with the control.' },
        { type: 'h2', text: 'API keys' },
        { type: 'p', text: 'Dashboard session only. `GET /api/keys` lists environments and keys (prefix only). `POST /api/keys` with `{ "environment_id": "env_...", "type": "sdk" | "secret", "label": "optional" }` creates a key and returns the plaintext once. `DELETE /api/keys/{id}` revokes it immediately.' },
    ],
};
