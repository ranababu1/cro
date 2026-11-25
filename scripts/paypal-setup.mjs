#!/usr/bin/env node
// Creates the FREEABTEST product, the four USD plans and (optionally) the webhook in PayPal, then prints the
// values to add in the hosting settings. Run once per mode (sandbox first, then live).
//
//   PAYPAL_API_BASE=https://api-m.sandbox.paypal.com PAYPAL_CLIENT_ID=... PAYPAL_CLIENT_SECRET=... \
//     node scripts/paypal-setup.mjs --webhook-url https://www.freeabtest.com/api/billing/paypal/webhook
//
// The secret is read from the environment and never printed.

const BASES = ['https://api-m.sandbox.paypal.com', 'https://api-m.paypal.com'];
const base = (process.env.PAYPAL_API_BASE || '').trim().replace(/\/+$/, '');
const id = (process.env.PAYPAL_CLIENT_ID || '').trim();
const secret = (process.env.PAYPAL_CLIENT_SECRET || '').trim();
const args = process.argv.slice(2);
const webhookUrl = args.includes('--webhook-url') ? args[args.indexOf('--webhook-url') + 1] : null;

if (!BASES.includes(base)) { console.error(`PAYPAL_API_BASE must be one of: ${BASES.join(', ')}`); process.exit(1); }
if (!id || !secret) { console.error('Set PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET.'); process.exit(1); }
if (webhookUrl && !/^https:\/\//.test(webhookUrl)) { console.error('--webhook-url must be an https URL.'); process.exit(1); }

const PLANS = [
    { env: 'PAYPAL_PLAN_STARTER_MONTHLY', name: 'Starter monthly', unit: 'MONTH', price: '10' },
    { env: 'PAYPAL_PLAN_STARTER_YEARLY', name: 'Starter yearly', unit: 'YEAR', price: '100' },
    { env: 'PAYPAL_PLAN_GROWTH_MONTHLY', name: 'Growth monthly', unit: 'MONTH', price: '50' },
    { env: 'PAYPAL_PLAN_GROWTH_YEARLY', name: 'Growth yearly', unit: 'YEAR', price: '500' },
];
const EVENTS = [
    'BILLING.SUBSCRIPTION.ACTIVATED', 'BILLING.SUBSCRIPTION.RE-ACTIVATED', 'BILLING.SUBSCRIPTION.UPDATED',
    'BILLING.SUBSCRIPTION.CANCELLED', 'BILLING.SUBSCRIPTION.SUSPENDED', 'BILLING.SUBSCRIPTION.EXPIRED',
    'BILLING.SUBSCRIPTION.PAYMENT.FAILED', 'PAYMENT.SALE.COMPLETED',
];

async function token() {
    const r = await fetch(`${base}/v1/oauth2/token`, {
        method: 'POST',
        headers: { Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString('base64')}`, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'grant_type=client_credentials',
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok || !d.access_token) throw new Error(`PayPal sign-in failed (${r.status}). Check the client id and secret for this mode.`);
    return d.access_token;
}

async function post(t, path, body) {
    const r = await fetch(`${base}${path}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json', Prefer: 'return=representation', 'PayPal-Request-Id': `fat-${path.replace(/\W/g, '')}-${Date.now()}-${Math.random().toString(36).slice(2)}` },
        body: JSON.stringify(body),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(`${path} answered ${r.status}: ${d.message || d.name || ''} ${JSON.stringify(d.details || '')}`);
    return d;
}

const t = await token();
const product = await post(t, '/v1/catalogs/products', {
    name: 'FREEABTEST', description: 'A/B testing service for websites', type: 'SERVICE', category: 'SOFTWARE', home_url: 'https://www.freeabtest.com',
});
const out = [];
for (const p of PLANS) {
    const plan = await post(t, '/v1/billing/plans', {
        product_id: product.id, name: `FREEABTEST ${p.name}`, status: 'ACTIVE',
        billing_cycles: [{ frequency: { interval_unit: p.unit, interval_count: 1 }, tenure_type: 'REGULAR', sequence: 1, total_cycles: 0, pricing_scheme: { fixed_price: { value: p.price, currency_code: 'USD' } } }],
        payment_preferences: { auto_bill_outstanding: true, setup_fee_failure_action: 'CANCEL', payment_failure_threshold: 3 },
    });
    out.push(`${p.env}=${plan.id}`);
}
if (webhookUrl) {
    const hook = await post(t, '/v1/notifications/webhooks', { url: webhookUrl, event_types: EVENTS.map((name) => ({ name })) });
    out.push(`PAYPAL_WEBHOOK_ID=${hook.id}`);
}
console.log(`Product ${product.id} created (${base.includes('sandbox') ? 'sandbox' : 'live'}). Add these in the hosting settings:\n`);
console.log(`PAYPAL_API_BASE=${base}`);
for (const line of out) console.log(line);
console.log('\nAlso set PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET and NEXT_PUBLIC_PAYPAL_CLIENT_ID (same value as PAYPAL_CLIENT_ID), then redeploy.');
