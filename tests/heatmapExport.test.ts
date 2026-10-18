import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { useTempDatabase, seedProjectDomain, flowExperimentBody } from './helpers';
import { exportFileName, EXPORT_SCHEMA, ingestCapture } from '@/lib/heatmaps';

const session = vi.hoisted(() => ({ current: null as null | { user: { id: string } } }));
vi.mock('next-auth', () => ({ getServerSession: vi.fn(async () => session.current) }));

import { db } from '@/lib/db';
import { clearConfigCache } from '@/lib/configCache';
import { POST as create } from '@/app/api/experiments/route';
import { GET as exportRoute } from '@/app/api/experiments/[id]/heatmaps/export/route';

const req = (method: string, url: string, body?: unknown) => new NextRequest(`http://localhost${url}`, { method, headers: { 'Content-Type': 'application/json', Origin: 'http://localhost' }, body: body === undefined ? undefined : JSON.stringify(body) });
const p = (id: string) => ({ params: Promise.resolve({ id }) });

describe('heatmap JSON export', () => {
    let cleanup: () => void;
    const t: Record<string, { userId: string; orgId: string; expId: string; vars: { id: string; is_control: boolean }[] }> = {};
    async function tenant(name: string, plan: string) {
        const u = await db.createUser({ email: `${name}@example.com`, name });
        const ws = await db.ensureWorkspace(u);
        await db.updateOrganization(ws.orgId, { plan });
        await seedProjectDomain(ws.projectId, 'localhost');
        session.current = { user: { id: u.id } };
        const data = await (await create(req('POST', '/api/experiments', flowExperimentBody({ name: 'Pricing: Hero / CTA!' })))).json();
        return { userId: u.id, orgId: ws.orgId, expId: data.experiment.id, vars: data.variations };
    }
    beforeAll(async () => {
        cleanup = useTempDatabase();
        t.free = await tenant('hfree', 'free');
        t.paid = await tenant('hpaid', 'starter');
        clearConfigCache();
        for (const v of t.paid.vars) {
            await ingestCapture(t.paid.orgId, { experiment_id: t.paid.expId, variation_id: v.id, device: 'desktop', events: [
                { t: 'c', x: 500, y: 400, sel: 'a.cta' }, { t: 'c', x: 510, y: 405, sel: 'a.cta', rage: true }, { t: 's', d: 80 },
            ] });
        }
    });
    afterAll(() => cleanup());

    it('names files safely', () => {
        expect(exportFileName('Pricing: Hero / CTA!', 'all', new Date('2026-10-19T00:00:00Z'))).toBe('heatmaps-pricing-hero-cta-all-2026-10-19.json');
        expect(exportFileName('!!!', 'mobile', new Date('2026-10-19T00:00:00Z'))).toBe('heatmaps-test-mobile-2026-10-19.json');
    });

    it('is paid only and needs access to the test', async () => {
        session.current = { user: { id: t.free.userId } };
        const free = await exportRoute(req('GET', `/api/experiments/${t.free.expId}/heatmaps/export`), p(t.free.expId));
        expect(free.status).toBe(403);
        expect((await exportRoute(req('GET', `/api/experiments/${t.paid.expId}/heatmaps/export`), p(t.paid.expId))).status).toBe(404);
        session.current = null;
        expect((await exportRoute(req('GET', `/api/experiments/${t.paid.expId}/heatmaps/export`), p(t.paid.expId))).status).toBe(401);
    });

    it('downloads every variation with a field guide', async () => {
        session.current = { user: { id: t.paid.userId } };
        const res = await exportRoute(req('GET', `/api/experiments/${t.paid.expId}/heatmaps/export?device=desktop`), p(t.paid.expId));
        expect(res.status).toBe(200);
        expect(res.headers.get('content-disposition')).toMatch(/^attachment; filename="heatmaps-pricing-hero-cta-desktop-\d{4}-\d{2}-\d{2}\.json"$/);
        expect(res.headers.get('cache-control')).toBe('no-store');
        const body = await res.json();
        expect(body.schema).toBe(EXPORT_SCHEMA);
        expect(body.device).toBe('desktop');
        expect(body.fields.grid).toMatch(/columns/);
        expect(body.variations).toHaveLength(2);
        const v = body.variations[0];
        expect(v.totals.clicks).toBe(2);
        expect(v.totals.rage).toBe(1);
        expect(v.list[0].selector).toBe('a.cta');
        expect(body.truncated).toBeUndefined();
        const log = await db.getAuditLog(t.paid.orgId);
        expect(log.some((e: { action: string }) => e.action === 'heatmap:export')).toBe(true);
    });

    it('exports a single variation and rejects unknown ones', async () => {
        session.current = { user: { id: t.paid.userId } };
        const one = await (await exportRoute(req('GET', `/api/experiments/${t.paid.expId}/heatmaps/export?variation=${t.paid.vars[1].id}&device=bogus`), p(t.paid.expId))).json();
        expect(one.variations.map((v: { id: string }) => v.id)).toEqual([t.paid.vars[1].id]);
        expect(one.device).toBe('all');
        expect((await exportRoute(req('GET', `/api/experiments/${t.paid.expId}/heatmaps/export?variation=nope`), p(t.paid.expId))).status).toBe(404);
    });
});
