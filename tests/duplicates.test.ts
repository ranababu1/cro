import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { useTempDatabase } from './helpers';

const session = vi.hoisted(() => ({ current: null as null | { user: { id: string; email: string } } }));
vi.mock('next-auth', () => ({ getServerSession: vi.fn(async () => session.current) }));

import { db } from '@/lib/db';
import { clearConfigCache } from '@/lib/configCache';
import { hashIp } from '@/lib/telemetry';
import { findDuplicateGroups, maskPhone, normalizePhone } from '@/lib/duplicates';
import { GET as listDuplicates } from '@/app/api/admin/duplicates/route';
import { POST as suspension } from '@/app/api/admin/orgs/[id]/suspension/route';
import { PATCH as patchOrg } from '@/app/api/admin/orgs/[id]/route';
import { GET as listExperiments } from '@/app/api/experiments/route';
import { POST as bootstrap } from '@/app/api/sdk/bootstrap/route';

let cleanup: () => void;
type T = { user: { id: string; email: string }; orgId: string; projectId: string; key: string };
const t: Record<string, T> = {};

async function tenant(email: string, opts: { phone?: string; country?: string; ip?: string; host?: string; plan?: string } = {}): Promise<T> {
    const u = await db.createUser({ email, name: email });
    if (opts.phone) await db.updateUserProfile(u.id, { first_name: 'A', last_name: 'B', country: opts.country ?? 'US', phone: opts.phone, company: null, job_role: null, company_size: null, heard_from: null, primary_goal: null, marketing_opt_in: false });
    if (opts.ip) await db.setUserSignupIpHash(u.id, hashIp(opts.ip));
    const ws = await db.ensureWorkspace(u);
    if (opts.plan) await db.updateOrganization(ws.orgId, { plan: opts.plan });
    if (opts.host) await db.addDomain(ws.projectId, opts.host);
    const envs = await db.getEnvironments(ws.projectId);
    const key = (await db.createApiKey({ environmentId: envs.find((e) => e.key === 'prod')!.id, type: 'sdk' })).key;
    return { user: { id: u.id, email }, orgId: ws.orgId, projectId: ws.projectId, key };
}
const json = (method: string, url: string, body?: unknown, headers: Record<string, string> = {}) => new NextRequest(`http://localhost${url}`, {
    method, headers: { 'Content-Type': 'application/json', ...headers }, body: body === undefined ? undefined : JSON.stringify(body),
});
const p = (id: string) => ({ params: Promise.resolve({ id }) });
const as = (who: T | null) => { session.current = who ? { user: who.user } : null; };
const suspend = (orgId: string, value: boolean) => suspension(json('POST', `/api/admin/orgs/${orgId}/suspension`, { suspend: value, group: 'phone +14*****0123', reason: value ? 'Duplicate account' : null }), p(orgId));
const boot = (who: T) => bootstrap(json('POST', '/api/sdk/bootstrap', { url: 'https://shop-a.example.com/', user_id: 'v1' }, { 'X-API-Key': who.key, origin: 'https://shop-a.example.com' }));

beforeAll(async () => {
    cleanup = useTempDatabase();
    process.env.PLATFORM_ADMIN_EMAILS = 'root@example.com';
    t.admin = await tenant('root@example.com');
    t.a = await tenant('a@example.com', { phone: '+1 415-555-0123', ip: '203.0.113.5', host: 'shop-a.example.com' });
    t.b = await tenant('b@example.org', { phone: '(415) 555-0123', country: 'US', ip: '198.51.100.1' });
    t.c = await tenant('c@example.net', { ip: '203.0.113.5', host: 'www.example.com', plan: 'starter' });
    t.solo = await tenant('solo@example.io', { phone: '+44 20 7946 0958', ip: '192.0.2.77', host: 'solo-site.io' });
});
afterAll(() => { delete process.env.PLATFORM_ADMIN_EMAILS; cleanup(); });

describe('phone normalisation', () => {
    it('normalises to E.164 with the profile country, and masks for display', () => {
        expect(normalizePhone('+1 415-555-0123')).toBe('+14155550123');
        expect(normalizePhone('(415) 555-0123', 'US')).toBe('+14155550123');
        expect(normalizePhone('0044 20 7946 0958')).toBe('+442079460958');
        expect(normalizePhone('12')).toBeNull();
        expect(normalizePhone(null)).toBeNull();
        expect(maskPhone('+14155550123')).toBe('+14*****0123');
    });
});

describe('duplicate groups', () => {
    it('flags orgs sharing a phone, a hashed sign-up IP or a registrable domain, and nothing else', async () => {
        const groups = await findDuplicateGroups();
        const by = (kind: string) => groups.filter((g) => g.kind === kind).map((g) => ({ label: g.label, orgs: g.orgs.map((o) => o.id).sort() }));
        expect(by('phone')).toEqual([{ label: '+14*****0123', orgs: [t.a.orgId, t.b.orgId].sort() }]);
        expect(by('signup_ip')).toEqual([{ label: `IP hash ${hashIp('203.0.113.5')!.slice(0, 10)}`, orgs: [t.a.orgId, t.c.orgId].sort() }]);
        expect(by('domain')).toEqual([{ label: 'example.com', orgs: [t.a.orgId, t.c.orgId].sort() }]);
        expect(groups.flatMap((g) => g.orgs.map((o) => o.id))).not.toContain(t.solo.orgId);
        expect(groups.find((g) => g.kind === 'phone')!.orgs.find((o) => o.id === t.b.orgId)!.emails).toEqual(['b@example.org']);
        // Shown to admins without the raw IP or the full phone number.
        expect(JSON.stringify(groups)).not.toMatch(/203\.0\.113|4155550123/);
    });

    it('the list is for platform admins only', async () => {
        as(t.a);
        expect((await listDuplicates()).status).toBe(404);
        expect((await suspend(t.b.orgId, true)).status).toBe(404);
        as(t.admin);
        expect((await (await listDuplicates()).json()).groups).toHaveLength(3);
    });
});

describe('one-click suspend, enforced on the server', () => {
    it('suspends: the SDK serves nothing and the app refuses, with audit and abuse entries', async () => {
        as(t.a);
        expect((await boot(t.a)).status).toBe(200);
        as(t.admin);
        const res = await suspend(t.a.orgId, true);
        expect(await res.json()).toEqual({ changed: true, status: 'suspended' });
        clearConfigCache();
        const sdk = await boot(t.a);
        expect(sdk.status).toBe(403);
        expect(await sdk.json()).toEqual({ error: 'This account is suspended' });
        as(t.a);
        expect((await listExperiments(json('GET', '/api/experiments'))).status).toBe(403);
        // The signed-in app shows the suspended notice when every org of the user is suspended.
        expect((await db.getProjectsForUser(t.a.user.id)).every((x) => x.org_status === 'suspended')).toBe(true);
        const audit = (await db.getAuditLog(t.a.orgId, 20)).find((e) => e.action === 'admin:suspend')!;
        expect(JSON.parse(audit.diff!)).toMatchObject({ by: 'root@example.com', source: 'duplicates', group: 'phone +14*****0123', reason: 'Duplicate account' });
        const abuse = (await db.getAbuseLog()).find((e) => e.action === 'abuse:org_suspended')!;
        expect(abuse.org_id).toBe(t.a.orgId);
        expect((await db.getOrganization(t.a.orgId))!.suspended_reason).toBe('Duplicate account');
    });

    it('a repeat click changes nothing and logs nothing', async () => {
        as(t.admin);
        const before = (await db.getAbuseLog()).length;
        expect(await (await suspend(t.a.orgId, true)).json()).toEqual({ changed: false, status: 'suspended' });
        expect((await db.getAbuseLog()).length).toBe(before);
    });

    it('unsuspends and logs it', async () => {
        as(t.admin);
        expect(await (await suspend(t.a.orgId, false)).json()).toEqual({ changed: true, status: 'active' });
        clearConfigCache();
        expect((await boot(t.a)).status).toBe(200);
        as(t.a);
        expect((await listExperiments(json('GET', '/api/experiments'))).status).toBe(200);
        expect((await db.getAuditLog(t.a.orgId, 20)).some((e) => e.action === 'admin:reactivate')).toBe(true);
        expect((await db.getAbuseLog()).some((e) => e.action === 'abuse:org_unsuspended' && e.org_id === t.a.orgId)).toBe(true);
    });

    it('the suspended state shows in the duplicates list', async () => {
        as(t.admin);
        await suspend(t.c.orgId, true);
        const g = (await findDuplicateGroups()).find((x) => x.kind === 'domain')!;
        expect(g.orgs.find((o) => o.id === t.c.orgId)!.status).toBe('suspended');
        await suspend(t.c.orgId, false);
    });

    it('suspending from the tenant page also writes the abuse log', async () => {
        as(t.admin);
        expect((await patchOrg(json('PATCH', `/api/admin/orgs/${t.solo.orgId}`, { status: 'suspended', suspended_reason: 'Spam' }), p(t.solo.orgId))).status).toBe(200);
        const e = (await db.getAbuseLog()).find((x) => x.action === 'abuse:org_suspended' && x.org_id === t.solo.orgId)!;
        expect(JSON.parse(e.diff!)).toMatchObject({ by: 'root@example.com', source: 'tenant', reason: 'Spam' });
        await patchOrg(json('PATCH', `/api/admin/orgs/${t.solo.orgId}`, { status: 'active', suspended_reason: null }), p(t.solo.orgId));
        expect((await db.getAbuseLog()).some((x) => x.action === 'abuse:org_unsuspended' && x.org_id === t.solo.orgId)).toBe(true);
    });
});
