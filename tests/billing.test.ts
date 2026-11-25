import fs from 'node:fs';
import { describe, it, expect, beforeAll, afterAll, afterEach, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { useTempDatabase } from './helpers';

const session = vi.hoisted(() => ({ current: null as null | { user: { id: string } } }));
vi.mock('next-auth', () => ({ getServerSession: vi.fn(async () => session.current) }));

import { db } from '@/lib/db';
import { clearConfigCache } from '@/lib/configCache';
import { computeEntitlements, getOrgEntitlements } from '@/lib/entitlements';
import { billingEnabled, paypalConfig, planForPayPalPlanId, PAYPAL_ENV, PAYPAL_PLAN_ENV } from '@/lib/billing/config';
import { clearPayPalTokenCache, verifyWebhookSignature } from '@/lib/billing/paypal';
import { paypalState } from '@/lib/billing/provider';
import { subscriptionIdOfEvent } from '@/lib/billing/service';
import { GET as getBilling } from '@/app/api/billing/route';
import { POST as subscribe } from '@/app/api/billing/subscribe/route';
import { POST as confirm } from '@/app/api/billing/paypal/confirm/route';
import { POST as webhook } from '@/app/api/billing/paypal/webhook/route';

const SANDBOX = 'https://api-m.sandbox.paypal.com';
const ENV: Record<string, string> = {
    PAYPAL_API_BASE: SANDBOX, PAYPAL_CLIENT_ID: 'cid', PAYPAL_CLIENT_SECRET: 'secret', NEXT_PUBLIC_PAYPAL_CLIENT_ID: 'cid', PAYPAL_WEBHOOK_ID: 'WH-1',
    PAYPAL_PLAN_STARTER_MONTHLY: 'P-SM', PAYPAL_PLAN_STARTER_YEARLY: 'P-SY', PAYPAL_PLAN_GROWTH_MONTHLY: 'P-GM', PAYPAL_PLAN_GROWTH_YEARLY: 'P-GY',
};
const ALL_KEYS = [...PAYPAL_ENV, ...Object.values(PAYPAL_PLAN_ENV).flatMap((p) => Object.values(p))];
const setEnv = (on: boolean) => { for (const k of ALL_KEYS) { if (on) process.env[k] = ENV[k]; else delete process.env[k]; } };

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const req = (method: string, url: string, body?: unknown, headers: Record<string, string> = {}) =>
    new NextRequest(`http://localhost${url}`, { method, headers: { 'Content-Type': 'application/json', Origin: 'http://localhost', ...headers }, body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body) });
const SIG_HEADERS = { 'paypal-auth-algo': 'SHA256withRSA', 'paypal-cert-url': 'https://api.sandbox.paypal.com/cert', 'paypal-transmission-id': 't-1', 'paypal-transmission-sig': 'sig', 'paypal-transmission-time': '2026-11-25T10:00:00Z' };

/** Fake PayPal: token, subscription create and read, signature check. */
function fakePayPal(o: { subs: Record<string, Record<string, unknown>>; verify?: string }) {
    const calls: { url: string; body: string | null }[] = [];
    const fn = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        const body = typeof init?.body === 'string' ? init.body : null;
        calls.push({ url, body });
        if (url.endsWith('/v1/oauth2/token')) return json(200, { access_token: 'tok', expires_in: 3600 });
        if (url.endsWith('/v1/notifications/verify-webhook-signature')) return json(200, { verification_status: o.verify ?? 'SUCCESS' });
        if (url.endsWith('/v1/billing/subscriptions') && init?.method === 'POST') {
            const b = JSON.parse(body!);
            const id = `I-NEW${Object.keys(o.subs).length}AAAAAA`;
            o.subs[id] = { id, status: 'APPROVAL_PENDING', plan_id: b.plan_id, custom_id: b.custom_id };
            return json(201, o.subs[id]);
        }
        const m = url.match(/\/v1\/billing\/subscriptions\/([^/?]+)$/);
        if (m) return o.subs[m[1]] ? json(200, o.subs[m[1]]) : json(404, { name: 'RESOURCE_NOT_FOUND' });
        return json(404, {});
    });
    return { fn, calls };
}

describe('billing config', () => {
    afterEach(() => setEnv(false));
    it('is off until every PayPal variable is set and the API base is a PayPal host', () => {
        expect(billingEnabled({})).toBe(false);
        expect(billingEnabled(ENV)).toBe(true);
        for (const k of ALL_KEYS) expect(billingEnabled({ ...ENV, [k]: '' }), k).toBe(false);
        expect(billingEnabled({ ...ENV, PAYPAL_API_BASE: 'https://evil.example.com' })).toBe(false);
        expect(paypalConfig({ ...ENV, PAYPAL_API_BASE: 'https://api-m.paypal.com/' })?.mode).toBe('live');
        expect(paypalConfig(ENV)?.mode).toBe('sandbox');
    });
    it('maps the four PayPal plan ids to our plans and rejects others', () => {
        const cfg = paypalConfig(ENV)!;
        expect(planForPayPalPlanId(cfg, 'P-SM')).toEqual({ plan: 'starter', period: 'monthly' });
        expect(planForPayPalPlanId(cfg, 'P-SY')).toEqual({ plan: 'starter', period: 'yearly' });
        expect(planForPayPalPlanId(cfg, 'P-GM')).toEqual({ plan: 'growth', period: 'monthly' });
        expect(planForPayPalPlanId(cfg, 'P-GY')).toEqual({ plan: 'growth', period: 'yearly' });
        expect(planForPayPalPlanId(cfg, 'P-OTHER')).toBeNull();
        expect(planForPayPalPlanId(cfg, null)).toBeNull();
        expect(paypalState('ACTIVE')).toBe('active');
        expect(paypalState('APPROVED')).toBe('pending');
        expect(paypalState('WHATEVER')).toBe('pending');
        expect(subscriptionIdOfEvent({ event_type: 'PAYMENT.SALE.COMPLETED', resource: { id: 'SALE-1', billing_agreement_id: 'I-ABC1234' } })).toBe('I-ABC1234');
        expect(subscriptionIdOfEvent({ event_type: 'BILLING.SUBSCRIPTION.CANCELLED', resource: { id: 'I-ABC1234' } })).toBe('I-ABC1234');
    });
    it('a cancelled plan counts until its end date, then the billing plan is Free; an assigned plan still wins', () => {
        const now = Date.parse('2026-12-01T00:00:00Z');
        expect(computeEntitlements({ plan: 'growth', plan_ends_at: '2026-12-10T00:00:00.000Z' }, [], now).plan).toBe('growth');
        expect(computeEntitlements({ plan: 'growth', plan_ends_at: '2026-11-30T00:00:00.000Z' }, [], now).plan).toBe('free');
        expect(computeEntitlements({ plan: 'growth', plan_ends_at: '2026-11-30T00:00:00.000Z', plan_override: 'starter' }, [], now).plan).toBe('starter');
        expect(computeEntitlements({ plan: 'free', plan_ends_at: '2026-11-30T00:00:00.000Z' }, ['imrn.dev@gmail.com'], now).plan).toBe('enterprise');
    });
});

describe('webhook signature check', () => {
    beforeEach(() => clearPayPalTokenCache());
    afterEach(() => vi.unstubAllGlobals());
    it('sends the raw body unchanged to PayPal and needs SUCCESS', async () => {
        const cfg = paypalConfig(ENV)!;
        const raw = '{"id":"WH-EVT-1","event_type":"PAYMENT.SALE.COMPLETED","resource":{"amount":{"total":"10.00"},"n":1.50}}';
        const pp = fakePayPal({ subs: {} });
        vi.stubGlobal('fetch', pp.fn);
        expect(await verifyWebhookSignature(cfg, raw, new Headers(SIG_HEADERS))).toBe(true);
        const sent = pp.calls.find((c) => c.url.endsWith('verify-webhook-signature'))!.body!;
        expect(sent.endsWith(`"webhook_event":${raw}}`)).toBe(true);
        expect(JSON.parse(sent)).toMatchObject({ webhook_id: 'WH-1', transmission_id: 't-1', auth_algo: 'SHA256withRSA' });

        vi.stubGlobal('fetch', fakePayPal({ subs: {}, verify: 'FAILURE' }).fn);
        expect(await verifyWebhookSignature(cfg, raw, new Headers(SIG_HEADERS))).toBe(false);
    });
    it('refuses missing headers and bodies that are not a JSON object, without calling PayPal', async () => {
        const cfg = paypalConfig(ENV)!;
        const pp = fakePayPal({ subs: {} });
        vi.stubGlobal('fetch', pp.fn);
        const { ['paypal-transmission-sig']: _drop, ...partial } = SIG_HEADERS;
        void _drop;
        expect(await verifyWebhookSignature(cfg, '{"id":"x"}', new Headers(partial))).toBe(false);
        expect(await verifyWebhookSignature(cfg, '{"id":"x"},"webhook_id":"other"', new Headers(SIG_HEADERS))).toBe(false);
        expect(await verifyWebhookSignature(cfg, '[1]', new Headers(SIG_HEADERS))).toBe(false);
        expect(pp.calls).toHaveLength(0);
    });
});

describe('billing routes', () => {
    let cleanup: () => void;
    let ownerId: string, memberId: string, orgId: string, otherOrgId: string;
    const subs: Record<string, Record<string, unknown>> = {};
    let pp: ReturnType<typeof fakePayPal>;

    beforeAll(async () => {
        cleanup = useTempDatabase();
        const owner = await db.createUser({ email: 'owner@example.com', name: 'Owner' });
        ownerId = owner.id;
        orgId = (await db.ensureWorkspace(owner)).orgId;
        const member = await db.createUser({ email: 'member@example.com', name: 'Member' });
        memberId = member.id;
        await db.addMember(orgId, memberId, 'member');
        const other = await db.createUser({ email: 'other@example.com', name: 'Other' });
        otherOrgId = (await db.ensureWorkspace(other)).orgId;
    });
    beforeEach(() => {
        clearPayPalTokenCache();
        clearConfigCache();
        pp = fakePayPal({ subs });
        vi.stubGlobal('fetch', pp.fn);
        session.current = { user: { id: ownerId } };
    });
    afterEach(() => { setEnv(false); vi.unstubAllGlobals(); });
    afterAll(() => cleanup());

    const event = (id: string, type: string, resource: Record<string, unknown>) => req('POST', '/api/billing/paypal/webhook', JSON.stringify({ id, event_type: type, resource }), SIG_HEADERS);

    it('stays hidden while unconfigured: routes answer 404, GET says disabled, PayPal is never called', async () => {
        setEnv(false);
        expect(await (await getBilling(req('GET', '/api/billing'))).json()).toEqual({ enabled: false });
        expect((await subscribe(req('POST', '/api/billing/subscribe', { plan: 'starter', period: 'monthly' }))).status).toBe(404);
        expect((await confirm(req('POST', '/api/billing/paypal/confirm', { subscription_id: 'I-ABCDEF123' }))).status).toBe(404);
        expect((await webhook(event('WH-0', 'BILLING.SUBSCRIPTION.ACTIVATED', { id: 'I-ABCDEF123' }))).status).toBe(404);
        expect(pp.calls).toHaveLength(0);
        expect((await getOrgEntitlements(orgId)).plan).toBe('free');
    });

    it('only owners start checkout, and the subscription carries the org id', async () => {
        setEnv(true);
        session.current = { user: { id: memberId } };
        expect((await subscribe(req('POST', '/api/billing/subscribe', { plan: 'starter', period: 'monthly' }))).status).toBe(403);
        expect(await (await getBilling(req('GET', '/api/billing'))).json()).toEqual({ enabled: true, owner: false });
        session.current = { user: { id: ownerId } };
        expect((await subscribe(req('POST', '/api/billing/subscribe', { plan: 'pro', period: 'monthly' }))).status).toBe(400);
        const res = await subscribe(req('POST', '/api/billing/subscribe', { plan: 'growth', period: 'yearly' }));
        expect(res.status).toBe(200);
        const { id } = await res.json();
        expect(subs[id]).toMatchObject({ plan_id: 'P-GY', custom_id: orgId });
        expect((await getOrgEntitlements(orgId)).plan).toBe('free');
    });

    it('confirm reads PayPal, not the browser, and grants only an active subscription for our plan', async () => {
        setEnv(true);
        const id = Object.keys(subs)[0];
        // Still waiting for approval at PayPal: nothing granted.
        let r = await (await confirm(req('POST', '/api/billing/paypal/confirm', { subscription_id: id }))).json();
        expect(r.result).toBe('recorded');
        expect((await getOrgEntitlements(orgId)).plan).toBe('free');
        subs[id] = { ...subs[id], status: 'ACTIVE', billing_info: { next_billing_time: '2099-01-01T00:00:00Z', last_payment: { time: '2026-11-25T10:00:00Z' } } };
        r = await (await confirm(req('POST', '/api/billing/paypal/confirm', { subscription_id: id }))).json();
        expect(r.result).toBe('granted');
        expect((await getOrgEntitlements(orgId)).plan).toBe('growth');
        const status = await (await getBilling(req('GET', '/api/billing'))).json();
        expect(status).toMatchObject({ enabled: true, owner: true, mode: 'sandbox', plan: 'growth', subscription: { status: 'ACTIVE', plan: 'growth', period: 'yearly', next_billing_at: '2099-01-01T00:00:00.000Z' } });
        expect(status.manage_url).toContain('sandbox.paypal.com');
        // A second subscription is refused while one is active.
        expect((await subscribe(req('POST', '/api/billing/subscribe', { plan: 'starter', period: 'monthly' }))).status).toBe(409);
        // Someone else's subscription id is not found.
        subs['I-FOREIGN12345'] = { id: 'I-FOREIGN12345', status: 'ACTIVE', plan_id: 'P-GM', custom_id: otherOrgId };
        expect((await confirm(req('POST', '/api/billing/paypal/confirm', { subscription_id: 'I-FOREIGN12345' }))).status).toBe(404);
        expect((await getOrgEntitlements(otherOrgId)).plan).toBe('free');
    });

    it('webhooks need a valid signature', async () => {
        setEnv(true);
        vi.stubGlobal('fetch', fakePayPal({ subs, verify: 'FAILURE' }).fn);
        expect((await webhook(event('WH-BAD', 'BILLING.SUBSCRIPTION.ACTIVATED', { id: 'I-FOREIGN12345' }))).status).toBe(400);
        expect((await webhook(req('POST', '/api/billing/paypal/webhook', JSON.stringify({ id: 'WH-NOSIG' })))).status).toBe(400);
        expect((await getOrgEntitlements(otherOrgId)).plan).toBe('free');
    });

    it('applies each event once, and grants from a fresh PayPal read for an unknown plan id never', async () => {
        setEnv(true);
        subs['I-WEBHOOK12345'] = { id: 'I-WEBHOOK12345', status: 'ACTIVE', plan_id: 'P-SM', custom_id: otherOrgId, billing_info: { next_billing_time: '2099-02-01T00:00:00Z' } };
        // The payload claims Growth; the server reads Starter from PayPal.
        const first = await (await webhook(event('WH-1', 'PAYMENT.SALE.COMPLETED', { id: 'SALE-1', billing_agreement_id: 'I-WEBHOOK12345', plan_id: 'P-GM' }))).json();
        expect(first).toMatchObject({ ok: true, result: 'granted' });
        expect((await getOrgEntitlements(otherOrgId)).plan).toBe('starter');
        const reads = pp.calls.filter((c) => c.url.endsWith('/I-WEBHOOK12345')).length;
        const again = await (await webhook(event('WH-1', 'PAYMENT.SALE.COMPLETED', { id: 'SALE-1', billing_agreement_id: 'I-WEBHOOK12345' }))).json();
        expect(again).toEqual({ ok: true, duplicate: true });
        expect(pp.calls.filter((c) => c.url.endsWith('/I-WEBHOOK12345')).length).toBe(reads);
        // Unknown event types are acknowledged and ignored.
        expect(await (await webhook(event('WH-2', 'CUSTOMER.DISPUTE.CREATED', { id: 'PP-D-1' }))).json()).toEqual({ ok: true, ignored: true });
        // A plan id we do not sell grants nothing.
        const third = await db.createUser({ email: 'third@example.com', name: 'Third' });
        const thirdOrg = (await db.ensureWorkspace(third)).orgId;
        subs['I-UNKNOWNPLAN1'] = { id: 'I-UNKNOWNPLAN1', status: 'ACTIVE', plan_id: 'P-ELSE', custom_id: thirdOrg };
        expect(await (await webhook(event('WH-3', 'BILLING.SUBSCRIPTION.ACTIVATED', { id: 'I-UNKNOWNPLAN1' }))).json()).toMatchObject({ result: 'unknown_plan' });
        expect((await getOrgEntitlements(thirdOrg)).plan).toBe('free');
    });

    it('cancelled and suspended keep the plan until the paid period ends; expired ends it now', async () => {
        setEnv(true);
        subs['I-WEBHOOK12345'] = { ...subs['I-WEBHOOK12345'], status: 'CANCELLED', billing_info: {} };
        expect(await (await webhook(event('WH-4', 'BILLING.SUBSCRIPTION.CANCELLED', { id: 'I-WEBHOOK12345' }))).json()).toMatchObject({ result: 'ends_at_period_end' });
        const org = await db.getOrganization(otherOrgId);
        expect(org?.plan).toBe('starter');
        expect(org?.plan_ends_at).toBe('2099-02-01T00:00:00.000Z');
        expect((await getOrgEntitlements(otherOrgId)).plan).toBe('starter');
        subs['I-WEBHOOK12345'] = { ...subs['I-WEBHOOK12345'], status: 'EXPIRED' };
        expect(await (await webhook(event('WH-5', 'BILLING.SUBSCRIPTION.EXPIRED', { id: 'I-WEBHOOK12345' }))).json()).toMatchObject({ result: 'ended' });
        expect((await getOrgEntitlements(otherOrgId)).plan).toBe('free');
    });

    it('an admin-assigned plan still wins over billing', async () => {
        setEnv(true);
        await db.updateOrganization(orgId, { plan_override: 'enterprise' });
        clearConfigCache();
        expect((await getOrgEntitlements(orgId)).plan).toBe('enterprise');
        const id = Object.keys(subs)[0];
        subs[id] = { ...subs[id], status: 'SUSPENDED' };
        await webhook(event('WH-6', 'BILLING.SUBSCRIPTION.SUSPENDED', { id }));
        expect((await getOrgEntitlements(orgId)).plan).toBe('enterprise');
        expect((await db.getOrganization(orgId))?.plan).toBe('growth');
    });
});

describe('billing stays out of sight when off', () => {
    it('pricing buttons fall back to sign-in, and the nav shows Billing only when enabled', () => {
        const cards = fs.readFileSync('app/pricing/BillingCards.tsx', 'utf8');
        expect(cards).toContain('checkout = false');
        expect(cards).toMatch(/paid \? `\/signin\?callbackUrl=/);
        expect(fs.readFileSync('app/pricing/page.tsx', 'utf8')).toContain('checkout={billingEnabled()}');
        expect(fs.readFileSync('app/components/shell/AppShell.tsx', 'utf8')).toContain("billing && item('/settings/billing'");
        expect(fs.readFileSync('app/(app)/settings/billing/page.tsx', 'utf8')).toContain('notFound()');
        for (const f of ['app/api/billing/route.ts', 'app/api/billing/subscribe/route.ts', 'app/api/billing/paypal/confirm/route.ts', 'app/api/billing/paypal/webhook/route.ts']) {
            expect(fs.readFileSync(f, 'utf8'), f).toContain("export const runtime = 'nodejs'");
        }
        const example = fs.readFileSync('.env.example', 'utf8');
        for (const k of ALL_KEYS) expect(example, k).toMatch(new RegExp(`^${k}=$`, 'm'));
    });
});
