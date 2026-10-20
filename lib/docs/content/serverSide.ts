import type { DocPage } from '../types';

export const serverSide: DocPage = {
    slug: 'server-side',
    title: 'Server-side testing',
    description: 'Assign visitors and record events from your own backend with a secret key.',
    group: 'Guides',
    blocks: [
        { type: 'p', text: 'Run a test from your backend when the change lives in server code: pricing logic, search ranking, emails, or a page you render on the server. Your server picks the variation, renders it, and reports page views and conversions. Results show up on the same **Results** tab as browser tests.' },
        { type: 'callout', tone: 'warning', title: 'Secret key, server only', text: 'These endpoints take a secret key (`Authorization: Bearer cro_sk_...`) and refuse SDK keys. They send no CORS headers, so browsers cannot call them. Store the key in an environment variable. See [Environments and API keys](/docs/environments-and-keys).' },
        { type: 'callout', tone: 'later', title: 'Coming later', text: 'A Node.js package is planned. It will also decide locally, without a request per visitor, and send events in batches. Today, call the endpoints below with any HTTP client.' },
        { type: 'p', text: 'Visitor IDs follow the same rules as the browser SDK: 1 to 200 printable ASCII characters without spaces. Use a stable ID such as your user ID or a first-party cookie, so a visitor keeps the same variation on every request.' },
        { type: 'h2', text: 'Assign a visitor', id: 'assign' },
        { type: 'code', label: 'curl', code: `curl -X POST https://YOUR-HOST/api/server/assign \\
  -H 'Authorization: Bearer cro_sk_prod_...' \\
  -H 'Content-Type: application/json' \\
  -d '{"experiment_id": "exp_123", "user_id": "user_42"}'` },
        { type: 'p', text: 'The reply has the same shape as [POST /api/assign](/docs/rest-api#assign): `variation_id`, `variation_name`, `variation_url`, `assigned` and an optional `reason`. Assignment is sticky: a visitor who already has a variation always gets the same one back. It does not record a page view: send one with `/api/server/track` when the visitor sees the variation.' },
        { type: 'h2', text: 'Record page views and conversions', id: 'track' },
        { type: 'code', label: 'curl', code: `curl -X POST https://YOUR-HOST/api/server/track \\
  -H 'Authorization: Bearer cro_sk_prod_...' \\
  -H 'Content-Type: application/json' \\
  -d '{"events": [
    {"experiment_id": "exp_123", "variation_id": "var_b", "user_id": "user_42", "event_type": "page_view"},
    {"experiment_id": "exp_123", "variation_id": "var_b", "user_id": "user_42", "event_type": "conversion", "goal_id": "goal_1"}
  ]}'` },
        { type: 'p', text: 'Events use the same fields as [POST /api/track](/docs/rest-api#track). Send one event or up to 50 in `events`; group events and send them together rather than one request per event. Conversions count once per visitor per goal. On the free plan a conversion needs the `goal_id` of the test\'s click goal; other conversions are refused with `403`. A page view for a variation other than the visitor\'s assigned one is refused with `409`. When the organization reaches its monthly page view limit, the reply is `202` with `paused: true` and nothing is stored.' },
        { type: 'h2', text: 'Limits' },
        { type: 'list', items: [
            'Rate limited per secret key, like the browser SDK endpoints per key and IP. A `429` reply has a `Retry-After` header.',
            'Targeting rules (URL, device, source and so on) are applied by the browser SDK only. On the server, decide yourself which visitors enter a test.',
            'Data is recorded in the environment of the key, so a development key keeps test traffic out of production results.',
        ] },
    ],
};
