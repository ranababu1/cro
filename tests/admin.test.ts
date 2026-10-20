import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { useTempDatabase } from './helpers';

const session = vi.hoisted(() => ({ current: null as null | { user: { id: string; email: string } } }));
vi.mock('next-auth', () => ({ getServerSession: vi.fn(async () => session.current) }));

import { db } from '@/lib/db';
import { generateId } from '@/lib/ids';
import { isPlatformAdminEmail } from '@/lib/platformAdmin';
import { GET as listOrgs } from '@/app/api/admin/orgs/route';
import { GET as getOrg, PATCH as patchOrg } from '@/app/api/admin/orgs/[id]/route';
import { GET as listExperiments } from '@/app/api/experiments/route';
import { PATCH as patchExperiment } from '@/app/api/experiments/[id]/route';
import { GET as listKeys } from '@/app/api/keys/route';
import { POST as assign } from '@/app/api/assign/route';
import { POST as track } from '@/app/api/track/route';

let cleanup: () => void;
const users: Record<string, { id: string; email: string }> = {};
const orgs: Record<string, string> = {};
let tenantKey: string;
let tenantSecret: string;
let tenantExperiment: string;

const as = (who: keyof typeof users | null) => {
    session.current = who ? { user: users[who] } : null;
};
const r = (method: string, url: string, body?: unknown, headers: Record<string, string> = {}) =>
    new NextRequest(`http://localhost${url}`, {
        method,
        headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '2.2.2.2', Origin: 'https://shop.example.com', ...headers },
        body: body === undefined ? undefined : JSON.stringify(body),
    });
const p = (id: string) => ({ params: Promise.resolve({ id }) });

beforeAll(async () => {
    cleanup = useTempDatabase();
    process.env.PLATFORM_ADMIN_EMAILS = ' Root@Example.com , ops@example.com';
    for (const [k, email] of [['admin', 'root@example.com'], ['tenant', 'tenant@example.com'], ['other', 'other@example.com']] as const) {
        const u = await db.createUser({ email, name: k });
        users[k] = { id: u.id, email };
        orgs[k] = (await db.ensureWorkspace(u)).orgId;
    }
    const projectId = (await db.getProjectsForUser(users.tenant.id))[0].id;
    await db.addDomain(projectId, 'shop.example.com');
    const env = (await db.getEnvironments(projectId)).find((e) => e.key === 'prod')!;
    tenantKey = (await db.createApiKey({ environmentId: env.id, type: 'sdk' })).key;
    tenantSecret = (await db.createApiKey({ environmentId: env.id, type: 'secret' })).key;
    tenantExperiment = generateId('exp');
    await db.createExperiment(
        { id: tenantExperiment, project_id: projectId, user_id: users.tenant.id, name: 'T', status: 'running', traffic_allocation: 100 },
        [{ name: 'Control', weight: 50, is_control: true }, { name: 'B', weight: 50, is_control: false }],
    );
});
afterAll(() => {
    delete process.env.PLATFORM_ADMIN_EMAILS;
    cleanup();
});

describe('platform admin role', () => {
    it('comes only from PLATFORM_ADMIN_EMAILS, case insensitive', () => {
        expect(isPlatformAdminEmail('root@example.com')).toBe(true);
        expect(isPlatformAdminEmail('OPS@example.com')).toBe(true);
        expect(isPlatformAdminEmail('tenant@example.com')).toBe(false);
        expect(isPlatformAdminEmail(null)).toBe(false);
    });

    it('is separate from org roles: an org owner is not a platform admin', async () => {
        as('tenant');
        expect((await listOrgs()).status).toBe(404);
        expect((await getOrg(r('GET', '/'), p(orgs.other))).status).toBe(404);
        expect((await patchOrg(r('PATCH', '/', { status: 'suspended' }), p(orgs.other))).status).toBe(404);
        expect((await db.getOrganization(orgs.other))?.status).toBe('active');
    });

    it('blocks signed-out users and secret keys', async () => {
        as(null);
        expect((await listOrgs()).status).toBe(404);
        expect((await patchOrg(r('PATCH', '/', { status: 'suspended' }, { Authorization: `Bearer ${tenantSecret}` }), p(orgs.tenant))).status).toBe(404);
    });

    it('lists every tenant with members, projects and usage', async () => {
        await assign(r('POST', '/api/assign', { experiment_id: tenantExperiment, user_id: 'visitor-1' }, { 'X-API-Key': tenantKey }));
        as('admin');
        const res = await listOrgs();
        expect(res.status).toBe(200);
        const { tenants } = await res.json();
        expect(tenants).toHaveLength(3);
        const t = tenants.find((x: { org: { id: string } }) => x.org.id === orgs.tenant);
        expect(t.members[0].email).toBe('tenant@example.com');
        expect(t.projects).toHaveLength(1);
        expect(t.usage.total.experiments).toBe(1);
        expect(t.usage.month.visitors).toBe(1);
        expect(t.org.plan).toBe('free');
    });

    it('validates admin updates', async () => {
        as('admin');
        expect((await patchOrg(r('PATCH', '/', {}), p(orgs.tenant))).status).toBe(400);
        expect((await patchOrg(r('PATCH', '/', { monthly_visitor_limit: -1 }), p(orgs.tenant))).status).toBe(400);
        expect((await patchOrg(r('PATCH', '/', { name: 'x' }), p(orgs.tenant))).status).toBe(400);
        expect((await patchOrg(r('PATCH', '/', { plan: 'pro' }), p('org_missing'))).status).toBe(404);
    });
});

describe('tenant isolation', () => {
    it('still holds for normal users', async () => {
        as('other');
        expect((await (await listExperiments(r('GET', '/api/experiments'))).json()).experiments).toHaveLength(0);
        as('tenant');
        expect((await (await listExperiments(r('GET', '/api/experiments'))).json()).experiments).toHaveLength(1);
    });
});

describe('suspension', () => {
    it('blocks SDK keys, secret keys and dashboard APIs, and is audited', async () => {
        as('admin');
        const res = await patchOrg(r('PATCH', '/', { status: 'suspended', suspended_reason: 'Unpaid invoice' }), p(orgs.tenant));
        expect(res.status).toBe(200);
        expect((await res.json()).tenant.org.status).toBe('suspended');

        const vars = await db.getVariations(tenantExperiment);
        expect((await assign(r('POST', '/api/assign', { experiment_id: tenantExperiment, user_id: 'v9' }, { 'X-API-Key': tenantKey }))).status).toBe(403);
        expect((await track(r('POST', '/api/track', { experiment_id: tenantExperiment, variation_id: vars[0].id, user_id: 'v9', event_type: 'page_view' }, { 'X-API-Key': tenantKey }))).status).toBe(403);

        as(null);
        expect((await listExperiments(r('GET', '/api/experiments', undefined, { Authorization: `Bearer ${tenantSecret}` }))).status).toBe(403);

        as('tenant');
        expect((await listExperiments(r('GET', '/api/experiments'))).status).toBe(403);
        expect((await listKeys(r('GET', '/api/keys'))).status).toBe(403);

        // Other tenants are unaffected.
        as('other');
        expect((await listExperiments(r('GET', '/api/experiments'))).status).toBe(200);

        const log = await db.getAuditLog(orgs.tenant);
        const entry = log.find((l) => l.action === 'admin:suspend')!;
        expect(entry.actor_id).toBe(users.admin.id);
        expect(JSON.parse(entry.diff!).after.suspended_reason).toBe('Unpaid invoice');
    });

    it('reactivation restores access', async () => {
        as('admin');
        expect((await patchOrg(r('PATCH', '/', { status: 'active' }), p(orgs.tenant))).status).toBe(200);
        const org = await db.getOrganization(orgs.tenant);
        expect(org?.suspended_at).toBeNull();
        expect((await assign(r('POST', '/api/assign', { experiment_id: tenantExperiment, user_id: 'v9' }, { 'X-API-Key': tenantKey }))).status).toBe(200);
        as('tenant');
        expect((await listExperiments(r('GET', '/api/experiments'))).status).toBe(200);
        expect((await db.getAuditLog(orgs.tenant)).some((l) => l.action === 'admin:reactivate')).toBe(true);
    });
});

describe('quota hooks', () => {
    it('stops enrolling new visitors past the monthly limit but keeps existing ones', async () => {
        as('admin');
        // visitor-1 and v9 are already enrolled this month.
        await patchOrg(r('PATCH', '/', { plan: 'starter', monthly_visitor_limit: 2 }), p(orgs.tenant));
        const existing = await (await assign(r('POST', '/api/assign', { experiment_id: tenantExperiment, user_id: 'visitor-1' }, { 'X-API-Key': tenantKey }))).json();
        expect(existing.assigned).toBe(true);
        const fresh = await (await assign(r('POST', '/api/assign', { experiment_id: tenantExperiment, user_id: 'new-visitor' }, { 'X-API-Key': tenantKey }))).json();
        expect(fresh).toMatchObject({ assigned: false, reason: 'quota_exceeded' });
        expect((await db.getAuditLog(orgs.tenant)).some((l) => l.action === 'admin:update')).toBe(true);
    });

    it('blocks starting new experiments past the monthly limit', async () => {
        as('admin');
        await patchOrg(r('PATCH', '/', { monthly_experiment_limit: 1 }), p(orgs.tenant));
        // The running experiment has no started_at in this fixture, so start one to use the quota.
        const projectId = (await db.getProjectsForUser(users.tenant.id))[0].id;
        const ids = [generateId('exp'), generateId('exp')];
        for (const id of ids) {
            await db.createExperiment(
                { id, project_id: projectId, user_id: users.tenant.id, name: id, status: 'draft', traffic_allocation: 100 },
                [{ name: 'Control', weight: 50, is_control: true }, { name: 'B', weight: 50, is_control: false }],
                [{ name: 'CTA', selector: '#cta', is_primary: true }],
            );
        }
        as('tenant');
        expect((await patchExperiment(r('PATCH', '/', { status: 'running' }), p(ids[0]))).status).toBe(200);
        expect((await patchExperiment(r('PATCH', '/', { status: 'running' }), p(ids[1]))).status).toBe(403);
    });
});
