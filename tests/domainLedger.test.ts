import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { useTempDatabase, seedProjectDomain, flowExperimentBody } from './helpers';

const session = vi.hoisted(() => ({ current: null as null | { user: { id: string; email: string } } }));
vi.mock('next-auth', () => ({ getServerSession: vi.fn(async () => session.current) }));

import { db } from '@/lib/db';
import { registrableDomain, isLocalHost, getLedgerEntry, DOMAIN_FREE_TESTS, countDomainTest } from '@/lib/domainLedger';
import { clearAbuseThrottle } from '@/lib/abuse';
import { clearConfigCache } from '@/lib/configCache';
import { POST as addDomain } from '@/app/api/domains/route';
import { DELETE as removeDomain } from '@/app/api/domains/[id]/route';
import { POST as createExperiment } from '@/app/api/experiments/route';
import { PATCH as patchExperiment } from '@/app/api/experiments/[id]/route';
import { POST as bootstrap } from '@/app/api/sdk/bootstrap/route';
import { POST as track } from '@/app/api/track/route';

let cleanup: () => void;
type T = { user: { id: string; email: string }; orgId: string; projectId: string; devKey: string; prodKey: string };
const t: Record<string, T> = {};

async function tenant(email: string, plan = 'free'): Promise<T> {
    const u = await db.createUser({ email, name: email });
    const ws = await db.ensureWorkspace(u);
    await db.updateOrganization(ws.orgId, { plan });
    const envs = await db.getEnvironments(ws.projectId);
    const key = async (k: string) => (await db.createApiKey({ environmentId: envs.find((e) => e.key === k)!.id, type: 'sdk' })).key;
    return { user: { id: u.id, email }, orgId: ws.orgId, projectId: ws.projectId, devKey: await key('dev'), prodKey: await key('prod') };
}
const json = (method: string, url: string, body?: unknown, headers: Record<string, string> = {}) => new NextRequest(`http://localhost${url}`, {
    method, headers: { 'Content-Type': 'application/json', ...headers }, body: body === undefined ? undefined : JSON.stringify(body),
});
const p = (id: string) => ({ params: Promise.resolve({ id }) });
const add = (who: T, host: string) => { session.current = { user: who.user }; return addDomain(json('POST', '/api/domains', { host })); };
const abuse = async (action: string) => (await db.getAbuseLog()).filter((e) => e.action === action);

beforeAll(async () => {
    cleanup = useTempDatabase();
    process.env.PLATFORM_ADMIN_EMAILS = 'root@example.com';
    t.a = await tenant('a@example.com');
    t.b = await tenant('b@example.com');
    t.c = await tenant('c@example.com');
    t.paid = await tenant('paid@example.com', 'starter');
    t.admin = await tenant('root@example.com');
    clearAbuseThrottle();
});
afterAll(() => { delete process.env.PLATFORM_ADMIN_EMAILS; cleanup(); });

describe('registrableDomain (eTLD+1)', () => {
    it('lowercases, strips www and ports, and uses the public suffix list', () => {
        expect(registrableDomain('WWW.Example.com:8080')).toBe('example.com');
        expect(registrableDomain('https://shop.sub.example.com/path?q=1')).toBe('example.com');
        expect(registrableDomain('blog.example.co.uk')).toBe('example.co.uk');
        expect(registrableDomain('localhost')).toBeNull();
        expect(registrableDomain('127.0.0.1')).toBeNull();
        expect(isLocalHost('localhost')).toBe(true);
        expect(isLocalHost('app.localhost')).toBe(true);
        expect(isLocalHost('example.com')).toBe(false);
    });
});

describe('free domain rules', () => {
    it('allow one domain per free account; localhost does not count', async () => {
        expect((await add(t.a, 'localhost')).status).toBe(201);
        expect((await add(t.a, 'shop.example.com')).status).toBe(201);
        expect((await getLedgerEntry('example.com'))?.org_id).toBe(t.a.orgId);
        const second = await add(t.a, 'other.org');
        expect(second.status).toBe(403);
        expect((await second.json()).reason).toBe('domain_limit');
        expect(await abuse('abuse:domain_limit')).toHaveLength(1);
    });

    it('first claim wins: a subdomain of a claimed domain is refused on another free account', async () => {
        const res = await add(t.b, 'www.blog.example.com');
        expect(res.status).toBe(403);
        const body = await res.json();
        expect(body.reason).toBe('domain_taken');
        expect(body.error).toMatch(/Upgrade/);
        expect(await abuse('abuse:domain_taken')).toHaveLength(1);
    });

    it('paid orgs and admins are exempt from the ledger and the domain cap', async () => {
        expect((await add(t.paid, 'example.com')).status).toBe(201);
        expect((await add(t.paid, 'other.org')).status).toBe(201);
        expect((await add(t.admin, 'example.com')).status).toBe(201);
        expect((await add(t.admin, 'third.net')).status).toBe(201);
        expect((await getLedgerEntry('example.com'))?.org_id).toBe(t.a.orgId);
    });

    it('removing the domain releases the claim but keeps its used tests', async () => {
        await countDomainTest('example.com', t.a.orgId);
        session.current = { user: t.a.user };
        const d = (await db.listDomains(t.a.projectId)).find((x) => x.host === 'shop.example.com')!;
        expect((await removeDomain(json('DELETE', `/api/domains/${d.id}`), p(d.id))).status).toBe(200);
        const row = await getLedgerEntry('example.com');
        expect(row?.org_id).toBeNull();
        expect(row?.experiments_used).toBe(1);
        expect((await add(t.b, 'example.com')).status).toBe(201);
        expect((await getLedgerEntry('example.com'))?.org_id).toBe(t.b.orgId);
    });

    it('a domain that used its 10 free tests cannot be added by another free org', async () => {
        for (let i = 0; i < DOMAIN_FREE_TESTS; i++) await countDomainTest('used.io', t.b.orgId);
        const res = await add(t.c, 'used.io');
        expect(res.status).toBe(403);
        expect((await res.json()).reason).toBe('domain_exhausted');
        expect((await add(t.paid, 'used.io')).status).toBe(201);
    });
});

describe('per-domain test limit on start', () => {
    it('counts a first start against the domain and blocks once the domain hits 10', async () => {
        await seedProjectDomain(t.c.projectId, 'fresh.dev');
        session.current = { user: t.c.user };
        const mk = async (n: number, host: string) => {
            const res = await createExperiment(json('POST', '/api/experiments', flowExperimentBody({
                name: `D${n}`, control_url: `https://${host}/c${n}`,
                variations: [
                    { name: 'Control', url: `https://${host}/c${n}`, weight: 50, is_control: true },
                    { name: 'B', url: `https://${host}/b${n}`, weight: 50, is_control: false },
                ],
            })));
            expect(res.status).toBe(201);
            return (await db.getExperiments([t.c.projectId])).find((e) => e.name === `D${n}`)!.id;
        };
        const first = await mk(1, 'fresh.dev');
        expect((await patchExperiment(json('PATCH', `/api/experiments/${first}`, { status: 'running' }), p(first))).status).toBe(200);
        expect((await getLedgerEntry('fresh.dev'))?.experiments_used).toBe(1);
        await patchExperiment(json('PATCH', `/api/experiments/${first}`, { status: 'paused' }), p(first));

        for (let i = 1; i < DOMAIN_FREE_TESTS; i++) await countDomainTest('fresh.dev', t.c.orgId);
        clearConfigCache();
        const blocked = await mk(2, 'fresh.dev');
        const res = await patchExperiment(json('PATCH', `/api/experiments/${blocked}`, { status: 'running' }), p(blocked));
        expect(res.status).toBe(403);
        expect((await res.json()).reason).toBe('domain_exhausted');
        expect((await db.getExperiment(blocked))?.status).toBe('draft');
    });
});

describe('SDK origin enforcement', () => {
    const boot = (key: string, headers: Record<string, string>) => bootstrap(json('POST', '/api/sdk/bootstrap', { url: 'https://shop.paid.example/page', user_id: 'v1' }, { 'X-API-Key': key, ...headers }));

    it('accepts registered domains and refuses others, logging the attempt', async () => {
        clearAbuseThrottle();
        await seedProjectDomain(t.paid.projectId, 'shop.paid.example');
        expect((await (await boot(t.paid.prodKey, { Origin: 'https://shop.paid.example' })).json()).reason).not.toBe('domain_not_allowed');
        expect((await (await boot(t.paid.prodKey, { Referer: 'https://shop.paid.example/x' })).json()).reason).not.toBe('domain_not_allowed');
        expect((await (await boot(t.paid.prodKey, { Origin: 'https://evil.example' })).json()).reason).toBe('domain_not_allowed');
        await new Promise((r) => setTimeout(r, 20));
        expect((await abuse('abuse:origin_mismatch')).length).toBeGreaterThanOrEqual(1);
    });

    it('refuses requests with no Origin or Referer', async () => {
        expect((await (await boot(t.paid.prodKey, {})).json()).reason).toBe('origin_missing');
        const res = await track(json('POST', '/api/track', { experiment_id: 'x', variation_id: 'y', user_id: 'v', event_type: 'page_view' }, { 'X-API-Key': t.paid.prodKey }));
        expect(res.status).toBe(403);
    });

    it('allows localhost only for development keys', async () => {
        expect((await (await boot(t.paid.prodKey, { Origin: 'http://localhost:3000' })).json()).reason).toBe('domain_not_allowed');
        expect((await (await boot(t.paid.devKey, { Origin: 'http://localhost:3000' })).json()).reason).not.toBe('domain_not_allowed');
    });

    it('throttles repeated mismatch logs per org and host', async () => {
        clearAbuseThrottle();
        const before = (await abuse('abuse:origin_mismatch')).length;
        for (let i = 0; i < 5; i++) await boot(t.paid.prodKey, { Origin: 'https://spam.example' });
        await new Promise((r) => setTimeout(r, 20));
        expect((await abuse('abuse:origin_mismatch')).length).toBe(before + 1);
    });
});
