import type { DocPage } from '../types';

export const webhooks: DocPage = {
    slug: 'webhooks',
    title: 'Webhooks',
    description: 'Get a signed POST when a test finds a winner, finishes, shows a sample ratio warning or your plan reaches a limit.',
    group: 'Analysis',
    blocks: [
        { type: 'p', text: 'Webhooks send events to your own endpoint, for example to post in a chat channel or start a deploy. They are part of the paid plans. Owners add them under **Webhooks** in the dashboard; every member can see them.' },
        { type: 'h2', text: 'Events', id: 'events' },
        { type: 'list', items: [
            '`test.winner`: a running test found a winner on its primary goal. Checked about every 10 minutes. Sent once per winner.',
            '`test.completed`: a test was stopped, by hand, on schedule or by rolling out a version.',
            '`test.srm_warning`: the visitor split of a running test does not match its weights (sample ratio mismatch). Checked about every 10 minutes. Sent once per test.',
            '`quota.reached`: your organization used all of its monthly tested visitors or tracked pageviews. Sent once per limit per month.',
            '`ping`: sent only by the **Send test** button.',
        ] },
        { type: 'h2', text: 'Delivery', id: 'delivery' },
        { type: 'p', text: 'Each event is a JSON `POST` to your URL. The address must use https and point to a public host. Answer with any 2xx status within 5 seconds. Redirects are not followed. Events are usually sent within a minute or two, while your site or dashboard is in use. A failed delivery is retried after 1, 5, 30, 120 and 720 minutes, then marked failed. The **Recent deliveries** list shows the last 30 attempts, and records are kept for 30 days. You can add up to 5 endpoints.' },
        { type: 'code', label: 'Body', code: `{
  "id": "whd_8k2j...",
  "event": "test.winner",
  "created_at": "2026-10-19T08:30:00.000Z",
  "data": {
    "experiment": { "id": "exp_123", "name": "Homepage CTA", "status": "running", "url": "https://example.com/", "dashboard_url": "https://www.freeabtest.com/experiments/exp_123" },
    "winner": { "variation_id": "var_456", "name": "Variation 1" },
    "visitors": 4210
  }
}` },
        { type: 'p', text: 'Headers: `X-FreeABTest-Event` (the event name), `X-FreeABTest-Delivery` (the delivery id, the same on every retry, so you can ignore duplicates) and `X-FreeABTest-Signature`.' },
        { type: 'h2', text: 'Verify a delivery', id: 'verify' },
        { type: 'p', text: 'The signing secret is shown once, when you add the endpoint or replace the secret. The signature header looks like `t=1792400000,v1=5f2b...`. Compute an HMAC-SHA256 of `t`, a dot and the raw request body with your secret, and compare it with `v1`. Reject requests where `t` is more than 5 minutes old.' },
        { type: 'code', label: 'Node.js', code: `import crypto from 'node:crypto';

function verify(rawBody, header, secret) {
  const parts = Object.fromEntries(header.split(',').map((p) => p.split('=')));
  const expected = crypto.createHmac('sha256', secret).update(parts.t + '.' + rawBody).digest('hex');
  const fresh = Math.abs(Date.now() / 1000 - Number(parts.t)) < 300;
  return fresh && crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(parts.v1 || ''));
}` },
        { type: 'p', text: 'If you move to the free plan, deliveries stop. Your endpoints are kept, and you can still turn them off or delete them.' },
    ],
};
