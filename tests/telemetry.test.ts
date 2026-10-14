import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { useTempDatabase, flowExperimentBody, seedProjectDomain } from './helpers';

function json(method: string, url: string, body?: unknown) {
    return new NextRequest(`http://localhost${url}`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
    });
}

const session = vi.hoisted(() => ({ current: null as null | { user: { id: string; email: string } } }));
vi.mock('next-auth', () => ({ getServerSession: vi.fn(async () => session.current) }));

import { db } from '@/lib/db';
import { bumpMetric, METRICS, hashIp, recordProductEvent, utcDay } from '@/lib/telemetry';
import { GET as overview } from '@/app/api/admin/telemetry/route';
import { GET as usersApi } from '@/app/api/admin/telemetry/users/route';
import { GET as orgsApi } from '@/app/api/admin/telemetry/orgs/route';
import { GET as exportApi } from '@/app/api/admin/telemetry/export/route';
import { POST as createExperiment } from '@/app/api/experiments/route';
import { POST as addDomain } from '@/app/api/domains/route';

let cleanup: () => void;
let admin: { id: string; email: string };
let tenant: { id: string; email: string };
let orgId: string;
let projectId: string;

const as = (who: 'admin' | 'tenant' | null) => {
    session.current = who === 'admin' ? { user: admin } : who === 'tenant' ? { user: tenant } : null;
};
const r = (url: string) => new NextRequest(`http://localhost${url}`);

beforeAll(async () => {
    cleanup = useTempDatabase();
    process.env.PLATFORM_ADMIN_EMAILS = 'admin@example.com';
    const a = await db.createUser({ email: 'admin@example.com', name: 'Admin' });
    admin = { id: a.id, email: a.email };
    await db.ensureWorkspace(a);
    const t = await db.createUser({ email: 'tenant@example.com', name: 'Tenant' });
    tenant = { id: t.id, email: t.email };
    const ws = await db.ensureWorkspace(t);
    orgId = ws.orgId;
    projectId = ws.projectId;
});
afterAll(() => {
    delete process.env.PLATFORM_ADMIN_EMAILS;
    cleanup();
});

describe('telemetry helpers', () => {
    it('hashes IPs and never returns the raw value', () => {
        const h = hashIp('1.2.3.4');
        expect(h).toBeTruthy();
        expect(h).not.toContain('1.2.3.4');
        expect(hashIp(null)).toBeNull();
    });

    it('bumps daily counters for platform and org scopes', async () => {
        await bumpMetric(METRICS.signups, { orgId, userId: tenant.id, by: 2 });
        const day = utcDay();
        const rows = await db.getTelemetryRange({ from: day, to: day, scopeType: 'platform', scopeId: 'platform', metrics: [METRICS.signups] });
        expect(rows.some((x) => x.value >= 2)).toBe(true);
        const orgSum = await db.sumTelemetry({ from: day, to: day, scopeType: 'org', scopeId: orgId, metric: METRICS.signups });
        expect(orgSum).toBeGreaterThanOrEqual(2);
    });

    it('records product events with hashed IP only', async () => {
        await recordProductEvent({ action: 'test.action', userId: tenant.id, orgId, ip: '9.9.9.9', meta: { ok: true } });
        const day = utcDay();
        const events = await db.listProductEvents({ from: day, to: day, userId: tenant.id });
        expect(events.length).toBeGreaterThan(0);
        const last = events[0];
        expect(last.ip_hash).toBeTruthy();
        expect(last.ip_hash).not.toContain('9.9.9.9');
        expect(last.meta).toContain('ok');
    });
});

describe('admin telemetry APIs', () => {
    it('404 for non-admins', async () => {
        as('tenant');
        expect((await overview(r('/api/admin/telemetry'))).status).toBe(404);
        expect((await usersApi(r('/api/admin/telemetry/users'))).status).toBe(404);
        expect((await orgsApi(r('/api/admin/telemetry/orgs'))).status).toBe(404);
        expect((await exportApi(r('/api/admin/telemetry/export'))).status).toBe(404);
    });

    it('returns overview, users, orgs and CSV for platform admin', async () => {
        as('admin');
        const ov = await overview(r('/api/admin/telemetry'));
        expect(ov.status).toBe(200);
        const body = await ov.json();
        expect(body.totals).toBeTruthy();
        expect(Array.isArray(body.series)).toBe(true);

        const u = await usersApi(r('/api/admin/telemetry/users?q=tenant'));
        expect(u.status).toBe(200);
        const uj = await u.json();
        expect(uj.rows.some((row: { email: string }) => row.email.includes('tenant'))).toBe(true);

        const o = await orgsApi(r('/api/admin/telemetry/orgs'));
        expect(o.status).toBe(200);

        const csv = await exportApi(r('/api/admin/telemetry/export?kind=overview'));
        expect(csv.status).toBe(200);
        expect(csv.headers.get('content-type')).toContain('text/csv');
        const text = await csv.text();
        expect(text).toContain('metric,value');
    });
});

describe('product hooks', () => {
    it('increments tests_created and domains_added on dashboard actions', async () => {
        as('tenant');
        await seedProjectDomain(projectId, 'localhost');
        const before = await db.sumTelemetry({
            from: utcDay(),
            to: utcDay(),
            scopeType: 'org',
            scopeId: orgId,
            metric: METRICS.tests_created,
        });
        const res = await createExperiment(json('POST', '/api/experiments', flowExperimentBody({ name: 'Telemetry test' })));
        expect(res.status).toBe(201);
        const after = await db.sumTelemetry({
            from: utcDay(),
            to: utcDay(),
            scopeType: 'org',
            scopeId: orgId,
            metric: METRICS.tests_created,
        });
        expect(after).toBeGreaterThan(before);

        const dBefore = await db.sumTelemetry({
            from: utcDay(),
            to: utcDay(),
            scopeType: 'org',
            scopeId: orgId,
            metric: METRICS.domains_added,
        });
        const dRes = await addDomain(json('POST', '/api/domains', { host: 'extra.telemetry.test' }));
        expect([200, 201]).toContain(dRes.status);
        const dAfter = await db.sumTelemetry({
            from: utcDay(),
            to: utcDay(),
            scopeType: 'org',
            scopeId: orgId,
            metric: METRICS.domains_added,
        });
        expect(dAfter).toBeGreaterThan(dBefore);
    });
});
