import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { NextRequest } from 'next/server';
import { sql } from 'drizzle-orm';
import { useTempDatabase } from './helpers';

const session = vi.hoisted(() => ({ current: null as null | { user: { id: string } } }));
vi.mock('next-auth', () => ({ getServerSession: vi.fn(async () => session.current) }));

import { db } from '@/lib/db';
import { getDb } from '@/lib/db/client';
import { RateLimiter } from '@/lib/rateLimit';
import { requireUserContext } from '@/lib/requestAuth';
import { popupConfigSchema } from '@/lib/popups';
import { visualChangeSchema } from '@/lib/visualChanges';
import { PATCH as patchPopup } from '@/app/api/popups/[id]/route';
import { PATCH as patchSurvey } from '@/app/api/surveys/[id]/route';

const cfg = (button_url: string) => ({ title: 'T', body: 'B', button_text: 'Go', button_url });

describe('safe link addresses', () => {
    it('refuses addresses that browsers read as another site', () => {
        for (const u of ['/\\evil.com', '/\\/evil.com', '//evil.com', 'javascript:alert(1)', 'https://a.com/\u0000x', '/a\\b']) {
            expect(popupConfigSchema.safeParse(cfg(u)).success, u).toBe(false);
            expect(visualChangeSchema.safeParse({ selector: 'a', action: 'attr', name: 'href', value: u }).success, u).toBe(false);
        }
        for (const u of ['/pricing', 'https://a.com/x?y=1#z', '#top', 'mailto:a@b.co', 'tel:+1']) {
            expect(popupConfigSchema.safeParse(cfg(u)).success, u).toBe(true);
            expect(visualChangeSchema.safeParse({ selector: 'img', action: 'attr', name: 'src', value: u }).success, u).toBe(true);
        }
    });
});

describe('secret key rate limit', () => {
    it('answers 429 with Retry-After once a secret key passes its limit', async () => {
        const limiter = new RateLimiter(2, 60_000);
        const req = () => new NextRequest('http://localhost/api/experiments', { headers: { Authorization: 'Bearer cro_sk_prod_' + 'a'.repeat(32) } });
        const results = [];
        for (let i = 0; i < 2; i++) {
            const r = await requireUserContext(req(), limiter);
            results.push(r instanceof Response ? r.status : 200);
        }
        expect(results.slice(0, 2).every((s) => s === 401)).toBe(true);
        const last = await requireUserContext(req(), limiter);
        expect((last as Response).status).toBe(429);
        expect((last as Response).headers.get('Retry-After')).toMatch(/^\d+$/);
    });
});

describe('popups and surveys in another organization', () => {
    let cleanup: () => void;
    const ids: Record<string, string> = {};
    beforeAll(async () => {
        cleanup = useTempDatabase();
        // A user who owns a paid org and was added to a second, free org.
        const u = await db.createUser({ email: 'two@example.com', name: 'Two' });
        const paid = await db.ensureWorkspace(u);
        await db.updateOrganization(paid.orgId, { plan: 'starter' });
        const other = await db.createUser({ email: 'other@example.com', name: 'Other' });
        const free = await db.ensureWorkspace(other);
        const d = await getDb();
        await d.run(sql`insert into memberships (org_id, user_id, role) values (${free.orgId}, ${u.id}, 'member')`);
        const cfgJson = JSON.stringify(cfg('/x'));
        ids.popup = (await db.createPopup({ project_id: free.projectId, name: 'Old popup', status: 'draft', config: cfgJson })).id;
        ids.survey = (await db.createSurvey({ project_id: free.projectId, name: 'Old survey', status: 'draft', config: JSON.stringify({ question: 'Why?', type: 'text' }) })).id;
        await db.updateOrganization(free.orgId, { plan: 'starter' });
        ids.paidProject = paid.projectId;
        ids.freeOrg = free.orgId;
        ids.paidOrg = paid.orgId;
        ids.user = u.id;
        session.current = { user: { id: u.id } };
    });
    afterAll(() => cleanup());

    const req = (url: string, body: unknown) => new NextRequest(`http://localhost${url}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Cookie: `cro_project=${ids.paidProject}` },
        body: JSON.stringify(body),
    });

    it('writes the audit entry to the organization that owns the popup', async () => {
        const res = await patchPopup(req(`/api/popups/${ids.popup}`, { name: 'Renamed' }), { params: Promise.resolve({ id: ids.popup }) });
        expect(res.status).toBe(200);
        const d = await getDb();
        const rows = await d.all<{ org_id: string }>(sql`select org_id from audit_log where entity_id = ${ids.popup}`);
        expect(rows.map((r) => r.org_id)).toEqual([ids.freeOrg]);
    });

    it('checks the plan of the organization that owns the item, not the selected project', async () => {
        await db.updateOrganization(ids.freeOrg, { plan: 'free' });
        const p = await patchPopup(req(`/api/popups/${ids.popup}`, { name: 'Again' }), { params: Promise.resolve({ id: ids.popup }) });
        expect(p.status).toBe(403);
        const s = await patchSurvey(req(`/api/surveys/${ids.survey}`, { name: 'Again' }), { params: Promise.resolve({ id: ids.survey }) });
        expect(s.status).toBe(403);
        const d = await getDb();
        const leaked = await d.all<{ n: number }>(sql`select count(*) as n from audit_log where org_id = ${ids.paidOrg} and entity in ('popup', 'survey')`);
        expect(Number(leaked[0].n)).toBe(0);
    });
});

describe('security headers', () => {
    it('sets framing, sniffing and referrer headers, and no referrer on share links', async () => {
        const cfgFile = path.join(process.cwd(), 'next.config.js');
        expect(fs.existsSync(cfgFile)).toBe(true);
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const conf = require(cfgFile);
        const rules = await conf.headers();
        const all = rules.find((r: { source: string }) => r.source === '/:path*').headers.map((h: { key: string; value: string }) => `${h.key}: ${h.value}`);
        expect(all).toEqual(expect.arrayContaining(['X-Content-Type-Options: nosniff', 'X-Frame-Options: DENY', "Content-Security-Policy: frame-ancestors 'none'"]));
        const share = rules.find((r: { source: string }) => r.source === '/share/:path*');
        expect(share.headers).toEqual([{ key: 'Referrer-Policy', value: 'no-referrer' }]);
        expect(rules.indexOf(share)).toBeGreaterThan(rules.findIndex((r: { source: string }) => r.source === '/:path*'));
    });
});
