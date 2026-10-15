import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { useTempDatabase, seedProjectDomain, flowExperimentBody } from './helpers';
import { effectivePageviewLimit, clearPageviewCache, getPageviewStatus, currentMonth } from '@/lib/pageviewQuota';
import { FREE_MONTHLY_PAGEVIEWS, PAID_MONTHLY_PAGEVIEWS } from '@/lib/plans';
import { adminUpdateOrgSchema } from '@/lib/validation';

const session = vi.hoisted(() => ({ current: null as null | { user: { id: string } } }));
vi.mock('next-auth', () => ({ getServerSession: vi.fn(async () => session.current) }));

import { db } from '@/lib/db';
import { POST as create } from '@/app/api/experiments/route';
import { PATCH as patch } from '@/app/api/experiments/[id]/route';
import { POST as bootstrap } from '@/app/api/sdk/bootstrap/route';
import { POST as track } from '@/app/api/track/route';
import { GET as plan } from '@/app/api/plan/route';

describe('effective limit', () => {
    it('uses plan default, override, unlimited and admin exemption', () => {
        expect(effectivePageviewLimit({ plan: 'free', monthly_pageview_limit: null }, false)).toBe(FREE_MONTHLY_PAGEVIEWS);
        expect(FREE_MONTHLY_PAGEVIEWS).toBeNull();
        expect(effectivePageviewLimit({ plan: 'team', monthly_pageview_limit: null }, false)).toBe(PAID_MONTHLY_PAGEVIEWS);
        expect(effectivePageviewLimit({ plan: 'free', monthly_pageview_limit: 5 }, false)).toBe(5);
        expect(effectivePageviewLimit({ plan: 'free', monthly_pageview_limit: -1 }, false)).toBeNull();
        expect(effectivePageviewLimit({ plan: 'free', monthly_pageview_limit: 5 }, true)).toBeNull();
    });
    it('admin schema accepts -1 and null for pageviews only', () => {
        expect(adminUpdateOrgSchema.safeParse({ monthly_pageview_limit: -1 }).success).toBe(true);
        expect(adminUpdateOrgSchema.safeParse({ monthly_pageview_limit: null }).success).toBe(true);
        expect(adminUpdateOrgSchema.safeParse({ monthly_pageview_limit: -2 }).success).toBe(false);
        expect(adminUpdateOrgSchema.safeParse({ monthly_visitor_limit: -1 }).success).toBe(false);
    });
});

describe('collection pauses at the cap', () => {
    let cleanup: () => void;
    let sdkKey: string;
    let orgId: string;
    let expId: string;
    const req = (url: string, body: unknown, headers: Record<string, string> = {}, method = 'POST') =>
        new NextRequest(`http://localhost${url}`, { method, headers: { 'Content-Type': 'application/json', Origin: 'http://localhost', ...headers }, body: body === undefined ? undefined : JSON.stringify(body) });
    const boot = (user: string, url = 'http://localhost/demo/control.html') => bootstrap(req('/api/sdk/bootstrap', { url, user_id: user }, { 'X-API-Key': sdkKey })).then((r) => r.json());

    beforeAll(async () => {
        process.env.PLATFORM_ADMIN_EMAILS = 'imrn.dev@gmail.com';
        cleanup = useTempDatabase();
        const u = await db.createUser({ email: 'q@example.com', name: 'Q' });
        const ws = await db.ensureWorkspace(u);
        orgId = (await db.getProjectsForUser(u.id))[0].org_id;
        await seedProjectDomain(ws.projectId, 'localhost');
        const env = (await db.getEnvironments(ws.projectId)).find((e) => e.key === 'dev')!;
        sdkKey = (await db.createApiKey({ environmentId: env.id, type: 'sdk' })).key;
        session.current = { user: { id: u.id } };
        expId = (await (await create(req('/api/experiments', flowExperimentBody()))).json()).experiment.id;
        await patch(req(`/api/experiments/${expId}`, { status: 'running' }, {}, 'PATCH'), { params: Promise.resolve({ id: expId }) });
        await db.updateOrganization(orgId, { monthly_pageview_limit: 3 });
    });
    afterAll(() => { delete process.env.PLATFORM_ADMIN_EMAILS; cleanup(); });
    beforeEach(() => clearPageviewCache());

    it('counts only pages in a running test and pauses at the cap', async () => {
        await boot('a', 'http://localhost/not-in-a-test');
        expect(await db.getMonthlyPageviews(orgId, currentMonth())).toBe(0);
        for (const u of ['a', 'b', 'c']) expect((await boot(u)).matched).toBe(true);
        expect(await db.getMonthlyPageviews(orgId, currentMonth())).toBe(3);
        const paused = await boot('d');
        expect(paused).toMatchObject({ matched: false, action: 'none', reason: 'quota_paused' });
        expect(await db.getAssignment(expId, 'd')).toBeNull();
        expect(await db.getMonthlyPageviews(orgId, currentMonth())).toBe(3);
    });

    it('drops events while paused without storing them', async () => {
        const vars = await db.getVariations(expId);
        const res = await track(req('/api/track', { experiment_id: expId, variation_id: vars[0].id, user_id: 'a', event_type: 'page_view' }, { 'X-API-Key': sdkKey }));
        expect(res.status).toBe(202);
        expect((await res.json()).paused).toBe(true);
    });

    it('reports usage to the dashboard', async () => {
        const body = await (await plan(new NextRequest('http://localhost/api/plan'))).json();
        expect(body.pageviews).toEqual({ used: 3, limit: 3, paused: true });
    });

    it('resumes when the cap is raised, and a super admin member is unlimited', async () => {
        await db.updateOrganization(orgId, { monthly_pageview_limit: 10 });
        clearPageviewCache();
        expect((await boot('e')).matched).toBe(true);
        await db.updateOrganization(orgId, { monthly_pageview_limit: 4 });
        clearPageviewCache();
        expect((await getPageviewStatus(orgId)).paused).toBe(true);
        // Add the super admin to the org: no cap.
        const admin = await db.createUser({ email: 'imrn.dev@gmail.com', name: 'Admin' });
        const { getDb } = await import('@/lib/db/client');
        const { memberships } = await import('@/lib/db/schema');
        await (await getDb()).insert(memberships).values({ org_id: orgId, user_id: admin.id, role: 'member' });
        clearPageviewCache();
        const st = await getPageviewStatus(orgId);
        expect(st.limit).toBeNull();
        expect(st.paused).toBe(false);
        expect((await boot('f')).matched).toBe(true);
    });
});
