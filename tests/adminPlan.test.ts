import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { useTempDatabase } from './helpers';

const session = vi.hoisted(() => ({ current: null as null | { user: { id: string; email: string } } }));
vi.mock('next-auth', () => ({ getServerSession: vi.fn(async () => session.current) }));

import { db } from '@/lib/db';
import { clearConfigCache } from '@/lib/configCache';
import { computeEntitlements, getOrgEntitlements } from '@/lib/entitlements';
import { getTenantSummary } from '@/lib/admin';
import { PATCH as patchOrg } from '@/app/api/admin/orgs/[id]/route';
import { GET as getPlan } from '@/app/api/plan/route';

let cleanup: () => void;
const users: Record<string, { id: string; email: string }> = {};
const orgs: Record<string, string> = {};
const as = (who: string | null) => { session.current = who ? { user: users[who] } : null; };
const patch = (body: unknown) => new NextRequest('http://localhost/', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const p = (id: string) => ({ params: Promise.resolve({ id }) });

beforeAll(async () => {
    cleanup = useTempDatabase();
    process.env.PLATFORM_ADMIN_EMAILS = 'ops@example.com';
    for (const [k, email] of [['super', 'imrn.dev@gmail.com'], ['ops', 'ops@example.com'], ['tenant', 'tenant@example.com']] as const) {
        const u = await db.createUser({ email, name: k });
        users[k] = { id: u.id, email };
        orgs[k] = (await db.ensureWorkspace(u)).orgId;
    }
});
afterAll(() => { delete process.env.PLATFORM_ADMIN_EMAILS; cleanup(); });

describe('platform admins are Enterprise', () => {
    it('resolves an org a platform admin owns to Enterprise, whatever billing says', async () => {
        for (const k of ['super', 'ops']) {
            const ent = await getOrgEntitlements(orgs[k]);
            expect((await db.getOrganization(orgs[k]))?.plan).toBe('free');
            expect(ent.plan).toBe('enterprise');
            expect(ent.planSource).toBe('platform_admin');
            expect(ent.paid).toBe(true);
            expect(ent.unlimited).toBe(true);
            expect(Object.values(ent.features).every(Boolean)).toBe(true);
            expect(ent.limits.monthlyPageviews).toBeNull();
        }
    });

    it('shows Enterprise in /api/plan and the admin summary', async () => {
        as('super');
        const res = await getPlan(new NextRequest('http://localhost/api/plan'));
        expect(res.status).toBe(200);
        expect((await res.json()).plan).toBe('enterprise');
        expect((await getTenantSummary(orgs.super))?.plan).toEqual({ effective: 'enterprise', source: 'platform_admin', billing: 'free' });
    });

    it('does not lift an org where the admin is only a member (owners only)', () => {
        const ent = computeEntitlements({ plan: 'free' }, []);
        expect(ent.plan).toBe('free');
        expect(ent.planSource).toBe('billing');
    });
});

describe('admin-assigned plan', () => {
    it('is admin only', async () => {
        for (const who of [null, 'tenant']) {
            as(who);
            const res = await patchOrg(patch({ plan_override: 'enterprise' }), p(orgs.tenant));
            expect(res.status).toBe(404);
        }
        clearConfigCache();
        expect((await db.getOrganization(orgs.tenant))?.plan_override).toBeNull();
        expect((await getOrgEntitlements(orgs.tenant)).plan).toBe('free');
    });

    it('rejects plans outside the four tiers', async () => {
        as('ops');
        expect((await patchOrg(patch({ plan_override: 'platinum' }), p(orgs.tenant))).status).toBe(400);
    });

    it('overrides billing, is audited, and shows in the admin summary', async () => {
        as('ops');
        for (const plan of ['starter', 'growth', 'enterprise', 'free'] as const) {
            await db.updateOrganization(orgs.tenant, { plan: plan === 'free' ? 'growth' : 'free' });
            const res = await patchOrg(patch({ plan_override: plan }), p(orgs.tenant));
            expect(res.status).toBe(200);
            const ent = await getOrgEntitlements(orgs.tenant);
            expect(ent.plan).toBe(plan);
            expect(ent.planSource).toBe('assigned');
            expect(ent.features.audit_log).toBe(plan !== 'free');
            expect(ent.features.visual_editor).toBe(plan === 'growth' || plan === 'enterprise');
            expect((await getTenantSummary(orgs.tenant))?.plan.effective).toBe(plan);
        }
        const org = await db.getOrganization(orgs.tenant);
        expect(org?.plan_override_by).toBe('ops@example.com');
        expect(org?.plan_override_at).toBeTruthy();
        const log = await db.getAuditLog(orgs.tenant, 50);
        const assigned = log.filter((a) => a.action === 'admin:plan_override');
        expect(assigned).toHaveLength(4);
        expect(JSON.parse(assigned[0].diff as string).by).toBe('ops@example.com');
    });

    it('only audits real changes', async () => {
        as('ops');
        const before = (await db.getAuditLog(orgs.tenant, 50)).length;
        expect((await patchOrg(patch({ plan_override: 'free' }), p(orgs.tenant))).status).toBe(200);
        expect((await db.getAuditLog(orgs.tenant, 50)).length).toBe(before);
    });

    it('removing it restores the billing plan', async () => {
        as('ops');
        await db.updateOrganization(orgs.tenant, { plan: 'starter' });
        const res = await patchOrg(patch({ plan_override: null }), p(orgs.tenant));
        expect(res.status).toBe(200);
        const ent = await getOrgEntitlements(orgs.tenant);
        expect(ent.plan).toBe('starter');
        expect(ent.planSource).toBe('billing');
        const org = await db.getOrganization(orgs.tenant);
        expect(org?.plan_override).toBeNull();
        expect(org?.plan_override_by).toBeNull();
        expect((await db.getAuditLog(orgs.tenant, 50)).some((a) => a.action === 'admin:plan_override_removed')).toBe(true);
    });

    it('can be set together with limits, auditing both', async () => {
        as('ops');
        const res = await patchOrg(patch({ plan_override: 'growth', monthly_visitor_limit: 500 }), p(orgs.tenant));
        expect(res.status).toBe(200);
        const log = await db.getAuditLog(orgs.tenant, 2);
        expect(log.map((a) => a.action).sort()).toEqual(['admin:plan_override', 'admin:update']);
        expect((await getOrgEntitlements(orgs.tenant)).plan).toBe('growth');
    });
});

describe('retention follows the effective plan', () => {
    it('keeps audit entries for admin-owned and assigned orgs, deletes billing-free ones', async () => {
        for (const k of ['super', 'ops', 'tenant']) await db.audit({ orgId: orgs[k], entity: 'organization', entityId: orgs[k], action: 'retention:probe' });
        const cut = { free: '9999-01-01', starter: '9999-01-01', growth: '0000-01-01', enterprise: '0000-01-01' };
        // ops is left out of the admin list here, so its org falls back to its free billing plan.
        await db.deleteOldAuditEntries(cut, 1000, ['imrn.dev@gmail.com']);
        const has = async (k: string) => (await db.getAuditLog(orgs[k], 100)).some((a) => a.action === 'retention:probe');
        expect(await has('super')).toBe(true);
        expect(await has('tenant')).toBe(true);
        expect(await has('ops')).toBe(false);
    });
});
