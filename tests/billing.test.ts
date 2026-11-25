import fs from 'node:fs';
import { describe, it, expect, beforeAll, afterAll, afterEach, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { useTempDatabase } from './helpers';

const session = vi.hoisted(() => ({ current: null as null | { user: { id: string } } }));
vi.mock('next-auth', () => ({ getServerSession: vi.fn(async () => session.current) }));

import { db } from '@/lib/db';
import { getTenantSummary } from '@/lib/admin';
import { auditLabel } from '@/lib/audit';
import { clearConfigCache } from '@/lib/configCache';
import { computeEntitlements, getOrgEntitlements } from '@/lib/entitlements';
import { billingEnabled, billingTestEmails, canUseBillingCheckout, paypalConfig, planForPayPalPlanId, PAYPAL_ENV, PAYPAL_PLAN_ENV } from '@/lib/billing/config';
import { clearPayPalTokenCache, verifyWebhookSignature } from '@/lib/billing/paypal';
import { classifyPlanChange, paypalState } from '@/lib/billing/provider';
import { getOwnerBillingAlert, subscriptionIdOfEvent } from '@/lib/billing/service';
import { GET as getBilling } from '@/app/api/billing/route';
import { POST as subscribe } from '@/app/api/billing/subscribe/route';
import { POST as changePlan } from '@/app/api/billing/change/route';
import { POST as cancelPlan } from '@/app/api/billing/cancel/route';
import { POST as confirm } from '@/app/api/billing/paypal/confirm/route';
import { POST as webhook } from '@/app/api/billing/paypal/webhook/route';

const SANDBOX = 'https://api-m.sandbox.paypal.com';
const LIVE = 'https://api-m.paypal.com';
const ENV: Record<string, string> = {
    PAYPAL_API_BASE: SANDBOX, PAYPAL_CLIENT_ID: 'cid', PAYPAL_CLIENT_SECRET: 'secret', NEXT_PUBLIC_PAYPAL_CLIENT_ID: 'cid', PAYPAL_WEBHOOK_ID: 'WH-1',
    PAYPAL_PLAN_STARTER_MONTHLY: 'P-SM', PAYPAL_PLAN_STARTER_YEARLY: 'P-SY', PAYPAL_PLAN_GROWTH_MONTHLY: 'P-GM', PAYPAL_PLAN_GROWTH_YEARLY: 'P-GY',
};
const ALL_KEYS = [...PAYPAL_ENV, ...Object.values(PAYPAL_PLAN_ENV).flatMap((p) => Object.values(p))];
const setEnv = (on: boolean, overrides: Record<string, string> = {}) => {
    for (const k of ALL_KEYS) {
        if (on) process.env[k] = overrides[k] ?? ENV[k];
        else delete process.env[k];
    }
    if (!on) {
        delete process.env.BILLING_TEST_EMAILS;
        delete process.env.PLATFORM_ADMIN_EMAILS;
    } else {
        if (overrides.BILLING_TEST_EMAILS !== undefined) process.env.BILLING_TEST_EMAILS = overrides.BILLING_TEST_EMAILS;
        if (overrides.PLATFORM_ADMIN_EMAILS !== undefined) process.env.PLATFORM_ADMIN_EMAILS = overrides.PLATFORM_ADMIN_EMAILS;
    }
};

const json = (status: number, body: unknown) => (status === 204 ? new Response(null, { status: 204 }) : new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }));
const req = (method: string, url: string, body?: unknown, headers: Record<string, string> = {}) =>
    new NextRequest(`http://localhost${url}`, { method, headers: { 'Content-Type': 'application/json', Origin: 'http://localhost', ...headers }, body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body) });
const SIG_HEADERS = { 'paypal-auth-algo': 'SHA256withRSA', 'paypal-cert-url': 'https://api.sandbox.paypal.com/cert', 'paypal-transmission-id': 't-1', 'paypal-transmission-sig': 'sig', 'paypal-transmission-time': '2026-11-25T10:00:00Z' };

/** Fake PayPal: token, subscription create/read/revise/cancel, signature check. */
function fakePayPal(o: {
    subs: Record<string, Record<string, unknown>>;
    verify?: string;
    reviseMode?: 'approve' | 'immediate' | 'unsupported';
}) {
    const calls: { url: string; method: string; body: string | null }[] = [];
    const fn = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        const method = init?.method ?? 'GET';
        const body = typeof init?.body === 'string' ? init.body : null;
        calls.push({ url, method, body });
        if (url.endsWith('/v1/oauth2/token')) return json(200, { access_token: 'tok', expires_in: 3600 });
        if (url.endsWith('/v1/notifications/verify-webhook-signature')) return json(200, { verification_status: o.verify ?? 'SUCCESS' });
        if (url.endsWith('/v1/billing/subscriptions') && method === 'POST') {
            const b = JSON.parse(body!);
            const id = `I-NEW${Object.keys(o.subs).length}AAAAAA`;
            const approveHref = `https://www.sandbox.paypal.com/webapps/billing/subscriptions?ba_token=BA-${id}`;
            o.subs[id] = { id, status: 'APPROVAL_PENDING', plan_id: b.plan_id, custom_id: b.custom_id, links: [{ rel: 'approve', href: approveHref, method: 'GET' }] };
            return json(201, o.subs[id]);
        }
        const rev = url.match(/\/v1\/billing\/subscriptions\/([^/?]+)\/revise$/);
        if (rev && method === 'POST') {
            const id = rev[1];
            const b = JSON.parse(body!);
            if (o.reviseMode === 'unsupported') return json(422, { name: 'SUBSCRIPTION_REVISION_NOT_SUPPORTED', message: 'Cannot revise across billing cycles' });
            if (o.reviseMode === 'immediate') {
                o.subs[id] = { ...o.subs[id], plan_id: b.plan_id };
                return json(200, { plan_id: b.plan_id, plan_overridden: false, links: [] });
            }
            // Default: PayPal returns an approve URL; plan_id stays until buyer approves.
            return json(200, {
                plan_id: b.plan_id,
                links: [{ rel: 'approve', href: `https://www.sandbox.paypal.com/webapps/billing/subscriptions/revise?token=REV-${id}-${b.plan_id}`, method: 'GET' }],
            });
        }
        const can = url.match(/\/v1\/billing\/subscriptions\/([^/?]+)\/cancel$/);
        if (can && method === 'POST') {
            const id = can[1];
            if (!o.subs[id]) return json(404, { name: 'RESOURCE_NOT_FOUND' });
            o.subs[id] = { ...o.subs[id], status: 'CANCELLED' };
            return json(204, null);
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

    it('restricts sandbox checkout to platform admins and BILLING_TEST_EMAILS, and opens to all in live mode', () => {
        expect(canUseBillingCheckout('anyone@example.com', {})).toBe(false);
        expect(canUseBillingCheckout('anyone@example.com', ENV)).toBe(false);
        expect(canUseBillingCheckout('imrn.dev@gmail.com', ENV)).toBe(true);
        expect(canUseBillingCheckout('admin@example.com', { ...ENV, PLATFORM_ADMIN_EMAILS: 'Admin@example.com' })).toBe(true);
        expect(canUseBillingCheckout('tester@example.com', { ...ENV, BILLING_TEST_EMAILS: ' one@example.com , Tester@Example.com ' })).toBe(true);
        expect(billingTestEmails({ BILLING_TEST_EMAILS: ' A@b.com, c@d.com ' })).toEqual(['a@b.com', 'c@d.com']);
        expect(canUseBillingCheckout('anyone@example.com', { ...ENV, PAYPAL_API_BASE: LIVE })).toBe(true);
    });

    it('maps the four PayPal plan ids to our plans and classifies plan changes', () => {
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
        expect(classifyPlanChange({ plan: 'starter', period: 'monthly' }, { plan: 'growth', period: 'monthly' })).toBe('upgrade');
        expect(classifyPlanChange({ plan: 'starter', period: 'monthly' }, { plan: 'starter', period: 'yearly' })).toBe('upgrade');
        expect(classifyPlanChange({ plan: 'growth', period: 'monthly' }, { plan: 'starter', period: 'monthly' })).toBe('downgrade');
        expect(classifyPlanChange({ plan: 'growth', period: 'yearly' }, { plan: 'growth', period: 'monthly' })).toBe('downgrade');
        expect(classifyPlanChange({ plan: 'starter', period: 'monthly' }, { plan: 'starter', period: 'monthly' })).toBe('same');
        expect(subscriptionIdOfEvent({ event_type: 'PAYMENT.SALE.COMPLETED', resource: { id: 'SALE-1', billing_agreement_id: 'I-ABC1234' } })).toBe('I-ABC1234');
        expect(subscriptionIdOfEvent({ event_type: 'BILLING.SUBSCRIPTION.CANCELLED', resource: { id: 'I-ABC1234' } })).toBe('I-ABC1234');
    });

    it('cancelled and scheduled downgrade plans take effect at period end; an assigned plan still wins', () => {
        const now = Date.parse('2026-12-01T00:00:00Z');
        expect(computeEntitlements({ plan: 'growth', plan_ends_at: '2026-12-10T00:00:00.000Z' }, [], now).plan).toBe('growth');
        expect(computeEntitlements({ plan: 'growth', plan_ends_at: '2026-11-30T00:00:00.000Z' }, [], now).plan).toBe('free');
        expect(computeEntitlements({ plan: 'growth', scheduled_plan: 'starter', scheduled_plan_at: '2026-12-10T00:00:00.000Z' }, [], now).plan).toBe('growth');
        expect(computeEntitlements({ plan: 'growth', scheduled_plan: 'starter', scheduled_plan_at: '2026-11-30T00:00:00.000Z' }, [], now).plan).toBe('starter');
        // If the subscription was cancelled (plan_ends_at set) with a scheduled target, it still drops to Free until they resubscribe.
        expect(computeEntitlements({ plan: 'growth', plan_ends_at: '2026-11-30T00:00:00.000Z', scheduled_plan: 'starter', scheduled_plan_at: '2026-11-30T00:00:00.000Z' }, [], now).plan).toBe('free');
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
    let ownerId: string, memberId: string, orgId: string, otherOrgId: string, otherOwnerId: string;
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
        otherOwnerId = other.id;
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

    const allow = (emails = 'owner@example.com,other@example.com') => setEnv(true, { BILLING_TEST_EMAILS: emails });
    const event = (id: string, type: string, resource: Record<string, unknown>) => req('POST', '/api/billing/paypal/webhook', JSON.stringify({ id, event_type: type, resource }), SIG_HEADERS);

    it('stays hidden while unconfigured: routes answer 404, GET says disabled, PayPal is never called', async () => {
        setEnv(false);
        expect(await (await getBilling(req('GET', '/api/billing'))).json()).toEqual({ enabled: false });
        expect((await subscribe(req('POST', '/api/billing/subscribe', { plan: 'starter', period: 'monthly' }))).status).toBe(404);
        expect((await changePlan(req('POST', '/api/billing/change', { plan: 'growth', period: 'monthly' }))).status).toBe(404);
        expect((await cancelPlan(req('POST', '/api/billing/cancel'))).status).toBe(404);
        expect((await confirm(req('POST', '/api/billing/paypal/confirm', { subscription_id: 'I-ABCDEF123' }))).status).toBe(404);
        expect((await webhook(event('WH-0', 'BILLING.SUBSCRIPTION.ACTIVATED', { id: 'I-ABCDEF123' }))).status).toBe(404);
        expect(pp.calls).toHaveLength(0);
        expect((await getOrgEntitlements(orgId)).plan).toBe('free');
    });

    it('in sandbox mode, restricts checkout to platform admins and BILLING_TEST_EMAILS', async () => {
        setEnv(true); // no BILLING_TEST_EMAILS, owner@example.com is not an admin
        expect(await (await getBilling(req('GET', '/api/billing'))).json()).toEqual({ enabled: false });
        expect((await subscribe(req('POST', '/api/billing/subscribe', { plan: 'starter', period: 'monthly' }))).status).toBe(403);
        expect((await changePlan(req('POST', '/api/billing/change', { plan: 'growth', period: 'monthly' }))).status).toBe(403);
        expect((await cancelPlan(req('POST', '/api/billing/cancel'))).status).toBe(403);
        expect((await confirm(req('POST', '/api/billing/paypal/confirm', { subscription_id: 'I-ABCDEF123' }))).status).toBe(403);
        expect(pp.calls).toHaveLength(0);

        // Allowlisting via BILLING_TEST_EMAILS opens it.
        allow('owner@example.com');
        expect((await getBilling(req('GET', '/api/billing'))).status).toBe(200);
        expect(await (await getBilling(req('GET', '/api/billing'))).json()).toMatchObject({ enabled: true, owner: true });

        // Platform admins also work without BILLING_TEST_EMAILS.
        setEnv(true, { PLATFORM_ADMIN_EMAILS: 'owner@example.com' });
        expect(await (await getBilling(req('GET', '/api/billing'))).json()).toMatchObject({ enabled: true, owner: true });
    });

    it('only owners start checkout, and the subscription carries the org id', async () => {
        allow('owner@example.com,member@example.com');
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
        allow();
        const id = Object.keys(subs)[0];
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
        allow();
        vi.stubGlobal('fetch', fakePayPal({ subs, verify: 'FAILURE' }).fn);
        expect((await webhook(event('WH-BAD', 'BILLING.SUBSCRIPTION.ACTIVATED', { id: 'I-FOREIGN12345' }))).status).toBe(400);
        expect((await webhook(req('POST', '/api/billing/paypal/webhook', JSON.stringify({ id: 'WH-NOSIG' })))).status).toBe(400);
        expect((await getOrgEntitlements(otherOrgId)).plan).toBe('free');
    });

    it('applies each event once, and grants from a fresh PayPal read for an unknown plan id never', async () => {
        allow();
        subs['I-WEBHOOK12345'] = { id: 'I-WEBHOOK12345', status: 'ACTIVE', plan_id: 'P-SM', custom_id: otherOrgId, billing_info: { next_billing_time: '2099-02-01T00:00:00Z', last_payment: { time: '2026-11-25T10:00:00Z' } } };
        const first = await (await webhook(event('WH-1', 'PAYMENT.SALE.COMPLETED', { id: 'SALE-1', billing_agreement_id: 'I-WEBHOOK12345', plan_id: 'P-GM' }))).json();
        expect(first).toMatchObject({ ok: true, result: 'granted' });
        expect((await getOrgEntitlements(otherOrgId)).plan).toBe('starter');
        const reads = pp.calls.filter((c) => c.url.endsWith('/I-WEBHOOK12345')).length;
        const again = await (await webhook(event('WH-1', 'PAYMENT.SALE.COMPLETED', { id: 'SALE-1', billing_agreement_id: 'I-WEBHOOK12345' }))).json();
        expect(again).toEqual({ ok: true, duplicate: true });
        expect(pp.calls.filter((c) => c.url.endsWith('/I-WEBHOOK12345')).length).toBe(reads);
        expect(await (await webhook(event('WH-2', 'CUSTOMER.DISPUTE.CREATED', { id: 'PP-D-1' }))).json()).toEqual({ ok: true, ignored: true });
        const third = await db.createUser({ email: 'third@example.com', name: 'Third' });
        const thirdOrg = (await db.ensureWorkspace(third)).orgId;
        subs['I-UNKNOWNPLAN1'] = { id: 'I-UNKNOWNPLAN1', status: 'ACTIVE', plan_id: 'P-ELSE', custom_id: thirdOrg };
        expect(await (await webhook(event('WH-3', 'BILLING.SUBSCRIPTION.ACTIVATED', { id: 'I-UNKNOWNPLAN1' }))).json()).toMatchObject({ result: 'unknown_plan' });
        expect((await getOrgEntitlements(thirdOrg)).plan).toBe('free');
    });

    it('upgrades immediately via PayPal revise when supported', async () => {
        allow();
        session.current = { user: { id: otherOwnerId } };
        // otherOrgId is on Starter monthly (I-WEBHOOK12345)
        const r = await changePlan(req('POST', '/api/billing/change', { plan: 'growth', period: 'monthly' }));
        expect(r.status).toBe(200);
        const body = await r.json();
        expect(body).toMatchObject({ action: 'approve', subscription_id: 'I-WEBHOOK12345' });
        expect(body.approve_url).toContain('revise');
        // Before approval, still Starter
        expect((await getOrgEntitlements(otherOrgId)).plan).toBe('starter');
        // After approval on PayPal, confirm syncs and immediately upgrades to Growth
        subs['I-WEBHOOK12345'] = { ...subs['I-WEBHOOK12345'], plan_id: 'P-GM' };
        const conf = await (await confirm(req('POST', '/api/billing/paypal/confirm', { subscription_id: 'I-WEBHOOK12345' }))).json();
        expect(conf.result).toBe('granted');
        expect((await getOrgEntitlements(otherOrgId)).plan).toBe('growth');
    });

    it('upgrades via new subscription then cancels old when PayPal revise is unsupported', async () => {
        allow();
        session.current = { user: { id: otherOwnerId } };
        // Downgrade test setup: put otherOrgId back on starter monthly cleanly first via direct PayPal sync
        pp = fakePayPal({ subs, reviseMode: 'unsupported' });
        vi.stubGlobal('fetch', pp.fn);
        subs['I-WEBHOOK12345'] = { ...subs['I-WEBHOOK12345'], plan_id: 'P-SM' };
        await webhook(event('WH-RESET-SM', 'BILLING.SUBSCRIPTION.UPDATED', { id: 'I-WEBHOOK12345' }));
        // Force org plan to starter for this test
        await db.updateOrganization(otherOrgId, { plan: 'starter', scheduled_plan: null, scheduled_period: null, scheduled_plan_at: null, plan_ends_at: null });
        clearConfigCache();

        const res = await changePlan(req('POST', '/api/billing/change', { plan: 'growth', period: 'yearly' }));
        expect(res.status).toBe(200);
        const created = await res.json();
        expect(created.action).toBe('checkout_new');
        expect(created.approve_url).toContain('sandbox.paypal.com');
        // Old subscription stays ACTIVE while new one is unapproved
        expect(subs['I-WEBHOOK12345'].status).toBe('ACTIVE');
        expect((await getOrgEntitlements(otherOrgId)).plan).toBe('starter');

        // Buyer approves the new subscription -> confirm grants Growth AND cancels old subscription at PayPal
        subs[created.id] = { ...subs[created.id], status: 'ACTIVE', billing_info: { next_billing_time: '2099-03-01T00:00:00Z', last_payment: { time: '2026-11-25T10:30:00Z' } } };
        const conf = await (await confirm(req('POST', '/api/billing/paypal/confirm', { subscription_id: created.id }))).json();
        expect(conf.result).toBe('granted');
        expect((await getOrgEntitlements(otherOrgId)).plan).toBe('growth');
        expect(subs['I-WEBHOOK12345'].status).toBe('CANCELLED');
        const oldRow = await db.getBillingSubscription('paypal', 'I-WEBHOOK12345');
        expect(oldRow?.status).toBe('CANCELLED');
    });

    it('downgrades take effect at period end (revise and fallback), never mid-cycle', async () => {
        allow();
        session.current = { user: { id: otherOwnerId } };
        const subId = (await db.listBillingSubscriptions(otherOrgId)).find((s) => s.status === 'ACTIVE')!.provider_subscription_id;

        // 1) Revise-supported downgrade: Growth -> Starter stays Growth until paid_through
        pp = fakePayPal({ subs, reviseMode: 'immediate' });
        vi.stubGlobal('fetch', pp.fn);
        const res = await changePlan(req('POST', '/api/billing/change', { plan: 'starter', period: 'monthly' }));
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.action).toBe('applied');
        expect(body.billing).toMatchObject({ plan: 'growth', scheduled_plan: 'starter', scheduled_period: 'monthly', scheduled_plan_at: '2099-03-01T00:00:00.000Z' });
        expect((await getOrgEntitlements(otherOrgId)).plan).toBe('growth');

        // When the next cycle's PAYMENT.SALE.COMPLETED arrives, Starter takes effect and clears scheduled_*
        subs[subId] = { ...subs[subId], billing_info: { next_billing_time: '2099-04-01T00:00:00Z', last_payment: { time: '2099-03-01T00:01:00Z' } } };
        await webhook(event('WH-RENEW-DOWN', 'PAYMENT.SALE.COMPLETED', { id: 'SALE-2', billing_agreement_id: subId }));
        expect((await getOrgEntitlements(otherOrgId)).plan).toBe('starter');
        expect((await db.getOrganization(otherOrgId))?.scheduled_plan).toBeNull();

        // 2) Revise-unsupported downgrade (Growth yearly -> Starter monthly): cancels at PayPal and keeps Growth until period end
        pp = fakePayPal({ subs, reviseMode: 'unsupported' });
        vi.stubGlobal('fetch', pp.fn);
        subs[subId] = { ...subs[subId], plan_id: 'P-GY', billing_info: { next_billing_time: '2099-05-01T00:00:00Z', last_payment: { time: '2099-04-01T00:01:00Z' } } };
        await webhook(event('WH-UP-GY', 'BILLING.SUBSCRIPTION.UPDATED', { id: subId }));
        expect((await getOrgEntitlements(otherOrgId)).plan).toBe('growth');

        const fb = await (await changePlan(req('POST', '/api/billing/change', { plan: 'starter', period: 'monthly' }))).json();
        expect(fb.action).toBe('scheduled_cancel');
        expect(subs[subId].status).toBe('CANCELLED');
        expect(fb.billing).toMatchObject({ plan: 'growth', plan_ends_at: '2099-05-01T00:00:00.000Z', scheduled_plan: 'starter', scheduled_period: 'monthly' });
        expect((await getOrgEntitlements(otherOrgId)).plan).toBe('growth');
    });

    it('in-app cancel cancels via PayPal API and keeps access until period end', async () => {
        allow();
        session.current = { user: { id: memberId } };
        expect((await cancelPlan(req('POST', '/api/billing/cancel'))).status).toBe(403);
        session.current = { user: { id: ownerId } };
        const id = Object.keys(subs).find((k) => subs[k].custom_id === orgId && subs[k].status === 'ACTIVE')!;
        const r = await cancelPlan(req('POST', '/api/billing/cancel'));
        expect(r.status).toBe(200);
        const body = await r.json();
        expect(subs[id].status).toBe('CANCELLED');
        expect(body.billing).toMatchObject({ plan: 'growth', plan_ends_at: '2099-01-01T00:00:00.000Z', subscription: { status: 'CANCELLED' } });
        expect((await getOrgEntitlements(orgId)).plan).toBe('growth');
    });

    it('handles PAYMENT.FAILED and SUSPENDED with owner-only alerts, and clears on PAYMENT.SALE.COMPLETED', async () => {
        allow();
        const freshUser = await db.createUser({ email: 'fail@example.com', name: 'Fail' });
        const freshOrg = (await db.ensureWorkspace(freshUser)).orgId;
        const freshMember = await db.createUser({ email: 'failmember@example.com', name: 'FailMember' });
        await db.addMember(freshOrg, freshMember.id, 'member');
        subs['I-FAIL123456'] = { id: 'I-FAIL123456', status: 'ACTIVE', plan_id: 'P-SM', custom_id: freshOrg, billing_info: { next_billing_time: '2099-06-01T00:00:00Z', last_payment: { time: '2026-11-25T10:00:00Z' } } };
        await webhook(event('WH-F1', 'BILLING.SUBSCRIPTION.ACTIVATED', { id: 'I-FAIL123456' }));
        expect(await getOwnerBillingAlert(freshOrg, freshUser.id)).toBeNull();

        // Payment failed while PayPal is still retrying (status ACTIVE)
        await webhook(event('WH-F2', 'BILLING.SUBSCRIPTION.PAYMENT.FAILED', { id: 'I-FAIL123456' }));
        const alert1 = await getOwnerBillingAlert(freshOrg, freshUser.id);
        expect(alert1?.kind).toBe('payment_failed');
        expect(await getOwnerBillingAlert(freshOrg, freshMember.id)).toBeNull();

        // Suspended after retries exhausted: keeps paid plan until paid_through, shows suspended alert
        subs['I-FAIL123456'] = { ...subs['I-FAIL123456'], status: 'SUSPENDED' };
        await webhook(event('WH-F3', 'BILLING.SUBSCRIPTION.SUSPENDED', { id: 'I-FAIL123456' }));
        const alert2 = await getOwnerBillingAlert(freshOrg, freshUser.id);
        expect(alert2).toMatchObject({ kind: 'suspended', endsAt: '2099-06-01T00:00:00.000Z' });
        expect((await getOrgEntitlements(freshOrg)).plan).toBe('starter');

        // Payment succeeds again -> clears alert and plan_ends_at
        subs['I-FAIL123456'] = { ...subs['I-FAIL123456'], status: 'ACTIVE', billing_info: { next_billing_time: '2099-07-01T00:00:00Z', last_payment: { time: '2026-11-26T10:00:00Z' } } };
        await webhook(event('WH-F4', 'PAYMENT.SALE.COMPLETED', { id: 'SALE-RECOVER', billing_agreement_id: 'I-FAIL123456' }));
        expect(await getOwnerBillingAlert(freshOrg, freshUser.id)).toBeNull();
        expect((await db.getOrganization(freshOrg))?.plan_ends_at).toBeNull();

        // Admin read-only summary sees subscription and webhook events
        const summary = await getTenantSummary(freshOrg);
        expect(summary?.subscriptions).toHaveLength(1);
        expect(summary?.subscriptions[0].provider_subscription_id).toBe('I-FAIL123456');
        const events = await db.listBillingWebhookEventsForResources(['I-FAIL123456']);
        expect(events.map((e) => e.event_type)).toContain('BILLING.SUBSCRIPTION.PAYMENT.FAILED');
        expect(auditLabel('billing', 'billing:payment_failed')).toBe('Billing payment failed');
    });

    it('an admin-assigned plan still wins over billing', async () => {
        allow();
        const id = Object.keys(subs).find((k) => subs[k].custom_id === orgId)!;
        await db.updateOrganization(orgId, { plan_override: 'enterprise' });
        clearConfigCache();
        expect((await getOrgEntitlements(orgId)).plan).toBe('enterprise');
        subs[id] = { ...subs[id], status: 'EXPIRED' };
        await webhook(event('WH-ADMIN-WIN', 'BILLING.SUBSCRIPTION.EXPIRED', { id }));
        expect((await getOrgEntitlements(orgId)).plan).toBe('enterprise');
        expect((await db.getOrganization(orgId))?.plan).toBe('free');
    });
});

describe('billing stays out of sight when off', () => {
    it('pricing buttons fall back to sign-in, and the nav shows Billing only when enabled', () => {
        const cards = fs.readFileSync('app/pricing/BillingCards.tsx', 'utf8');
        expect(cards).toContain('checkout = false');
        expect(cards).toMatch(/paid \? `\/signin\?callbackUrl=/);
        expect(fs.readFileSync('app/pricing/page.tsx', 'utf8')).toContain('canSessionCheckout');
        expect(fs.readFileSync('app/components/shell/AppShell.tsx', 'utf8')).toContain("billing && item('/settings/billing'");
        expect(fs.readFileSync('app/(app)/settings/billing/page.tsx', 'utf8')).toContain('notFound()');
        expect(fs.readFileSync('app/(app)/layout.tsx', 'utf8')).toContain('BillingAlertBanner');
        expect(fs.readFileSync('app/admin/orgs/[id]/page.tsx', 'utf8')).toContain('Billing (read-only)');
        for (const f of [
            'app/api/billing/route.ts', 'app/api/billing/subscribe/route.ts', 'app/api/billing/change/route.ts',
            'app/api/billing/cancel/route.ts', 'app/api/billing/paypal/confirm/route.ts', 'app/api/billing/paypal/webhook/route.ts',
        ]) {
            expect(fs.readFileSync(f, 'utf8'), f).toContain("export const runtime = 'nodejs'");
        }
        const example = fs.readFileSync('.env.example', 'utf8');
        for (const k of [...ALL_KEYS, 'BILLING_TEST_EMAILS']) expect(example, k).toMatch(new RegExp(`^${k}=$`, 'm'));
    });
});
