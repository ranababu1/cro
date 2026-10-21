import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { useTempDatabase, seedProjectDomain, flowExperimentBody } from './helpers';

const session = vi.hoisted(() => ({ current: null as null | { user: { id: string; email: string } } }));
vi.mock('next-auth', () => ({ getServerSession: vi.fn(async () => session.current) }));

import { db } from '@/lib/db';
import { registrableDomain, isLocalHost, getLedgerEntry, DOMAIN_FREE_TESTS } from '@/lib/domainLedger';
import { recordNewTest, testsCreatedThisMonth } from '@/lib/freeTests';
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

    it('removing the domain releases the claim; another free org can add it', async () => {
        session.current = { user: t.a.user };
        const d = (await db.listDomains(t.a.projectId)).find((x) => x.host === 'shop.example.com')!;
        expect((await removeDomain(json('DELETE', `/api/domains/${d.id}`), p(d.id))).status).toBe(200);
        expect((await getLedgerEntry('example.com'))?.org_id).toBeNull();
        expect((await add(t.b, 'example.com')).status).toBe(201);
        expect((await getLedgerEntry('example.com'))?.org_id).toBe(t.b.orgId);
    });

    it("a domain that used this month's free test on another account cannot be added by a free org until the month resets", async () => {
        session.current = { user: t.b.user };
        const d = (await db.listDomains(t.b.projectId)).find((x) => x.host === 'example.com')!;
        expect((await removeDomain(json('DELETE', `/api/domains/${d.id}`), p(d.id))).status).toBe(200);
        for (let i = 0; i < DOMAIN_FREE_TESTS; i++) await recordNewTest(t.b.orgId, 'used.io');
        // used.io was never claimed: claim it for b, release it, then c tries.
        expect((await add(t.b, 'used.io')).status).toBe(201);
        const u = (await db.listDomains(t.b.projectId)).find((x) => x.host === 'used.io')!;
        session.current = { user: t.b.user };
        await removeDomain(json('DELETE', `/api/domains/${u.id}`), p(u.id));
        const res = await add(t.c, 'used.io');
        expect(res.status).toBe(403);
        const body = await res.json();
        expect(body.reason).toBe('domain_exhausted');
        expect(body.error).toMatch(/1 [A-Z][a-z]+ \d{4}/);
        expect((await add(t.paid, 'used.io')).status).toBe(201);
    });
});

describe('free new tests per month, counted per domain', () => {
    const body = (n: number, host: string) => flowExperimentBody({
        name: `D${n}`, control_url: `https://${host}/c${n}`,
        variations: [
            { name: 'Control', url: `https://${host}/c${n}`, weight: 50, is_control: true },
            { name: 'B', url: `https://${host}/b${n}`, weight: 50, is_control: false },
        ],
    });
    it('a test created on a domain uses the domain allowance; another free account on a subdomain is refused this month', async () => {
        await seedProjectDomain(t.c.projectId, 'fresh.dev');
        session.current = { user: t.c.user };
        expect((await createExperiment(json('POST', '/api/experiments', body(1, 'fresh.dev')))).status).toBe(201);
        expect(await testsCreatedThisMonth('domain', 'fresh.dev')).toBe(1);
        expect(await testsCreatedThisMonth('org', t.c.orgId)).toBe(1);

        // A second free account with a subdomain of the same site (seeded directly, as if added before the claim).
        const other = await tenant('d@example.com');
        await seedProjectDomain(other.projectId, 'shop.fresh.dev');
        session.current = { user: other.user };
        const res = await createExperiment(json('POST', '/api/experiments', body(2, 'shop.fresh.dev')));
        expect(res.status).toBe(403);
        const out = await res.json();
        expect(out.reason).toBe('domain_monthly_tests');
        expect(out.error).toMatch(/fresh\.dev has already had its 1 new test a month/);
        expect(out.resets_at).toMatch(/^\d{4}-\d{2}-01T00:00:00/);
        expect(await testsCreatedThisMonth('org', other.orgId)).toBe(0);
    });

    it('paid orgs and admins do not use the domain allowance', async () => {
        for (const who of [t.paid, t.admin]) {
            await seedProjectDomain(who.projectId, 'fresh.dev');
            session.current = { user: who.user };
            expect((await createExperiment(json('POST', '/api/experiments', body(3, 'fresh.dev')))).status).toBe(201);
        }
        expect(await testsCreatedThisMonth('domain', 'fresh.dev')).toBe(1);
        clearConfigCache();
    });
});
