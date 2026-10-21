import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { sql } from 'drizzle-orm';
import { useTempDatabase } from './helpers';

const session = vi.hoisted(() => ({ current: null as null | { user: { id: string; email: string } } }));
vi.mock('next-auth', () => ({ getServerSession: vi.fn(async () => session.current) }));

import { db, getDb } from '@/lib/db';
import { clearConfigCache } from '@/lib/configCache';
import { auditRetentionDays, presentAudit, summarizeDiff, auditLabel, decodeCursor, encodeCursor, AUDIT_PAGE_SIZE } from '@/lib/audit';
import { retentionCutoffs, runRetention } from '@/lib/retention';
import { GET as getAudit } from '@/app/api/audit/route';

let cleanup: () => void;
type T = { user: { id: string; email: string }; orgId: string };
const t: Record<string, T> = {};
async function tenant(email: string, plan: string): Promise<T> {
    const u = await db.createUser({ email, name: email.split('@')[0] });
    const ws = await db.ensureWorkspace(u);
    await db.updateOrganization(ws.orgId, { plan });
    return { user: { id: u.id, email }, orgId: ws.orgId };
}
const call = async (who: T, q = '') => { session.current = { user: who.user }; return getAudit(new NextRequest(`http://localhost/api/audit?${q}`)); };
const ago = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString();
async function entry(orgId: string, o: { actor?: string | null; entity?: string; action?: string; diff?: unknown; at?: string; id?: string }) {
    const d = await getDb();
    await d.run(sql`insert into audit_log (id, org_id, actor_id, entity, entity_id, action, diff, created_at) values (${o.id ?? `aud_${Math.random().toString(36).slice(2)}`}, ${orgId}, ${o.actor ?? null}, ${o.entity ?? 'experiment'}, 'exp_1', ${o.action ?? 'update'}, ${o.diff === undefined ? null : JSON.stringify(o.diff)}, ${o.at ?? new Date().toISOString()})`);
}

beforeAll(async () => {
    cleanup = useTempDatabase();
    t.free = await tenant('free@example.com', 'free');
    t.starter = await tenant('starter@example.com', 'starter');
    t.growth = await tenant('growth@example.com', 'growth');
    t.ent = await tenant('ent@example.com', 'enterprise');
    clearConfigCache();
});
afterAll(() => cleanup());

describe('audit helpers', () => {
    it('retention follows the pricing table', () => {
        expect([auditRetentionDays('free'), auditRetentionDays(null), auditRetentionDays('starter'), auditRetentionDays('Growth'), auditRetentionDays('enterprise'), auditRetentionDays('team')]).toEqual([30, 30, 90, 365, 730, 90]);
    });
    it('labels and summarizes changes without long values', () => {
        expect(auditLabel('experiment', 'status:running')).toBe('Test started');
        expect(auditLabel('api_key', 'revoke')).toBe('API key revoked');
        expect(auditLabel('experiment', 'something:new')).toBe('Test something new');
        expect(summarizeDiff(JSON.stringify({ name: 'x'.repeat(80), goals: [1, 2], traffic_allocation: 50, nested: { a: 1 } }))).toBe(`name: ${'x'.repeat(57)}..., goals: 2 items, traffic allocation: 50, nested: changed`);
        expect(summarizeDiff('[1,2]')).toBeNull();
        expect(summarizeDiff('not json')).toBeNull();
    });
    it('shows support changes without their internal notes, and names API and automatic changes', () => {
        const base = { id: 'a', entity: 'organization', entity_id: 'org', diff: JSON.stringify({ by: 'staff@freeabtest.com', reason: 'internal' }), created_at: '2026-10-19T00:00:00Z', actor_name: 'Staff', actor_email: 'staff@freeabtest.com' };
        const team = presentAudit({ ...base, action: 'admin:suspend', actor_id: 'usr_staff', actor_member: 0 });
        expect(team.actor).toEqual({ kind: 'team', name: 'freeabtest.com' });
        expect(team.details).toBeNull();
        expect(JSON.stringify(team)).not.toContain('staff@');
        expect(presentAudit({ ...base, entity: 'experiment', action: 'allocation:auto', actor_id: null, actor_member: null, diff: null }).actor.name).toBe('Automatic');
        expect(presentAudit({ ...base, entity: 'experiment', action: 'create', actor_id: null, actor_member: null, diff: null }).actor.name).toBe('API key');
        expect(presentAudit({ ...base, entity: 'experiment', action: 'update', actor_id: 'usr_gone', actor_member: 0, actor_name: 'Gone' }).actor).toEqual({ kind: 'former', name: 'Former member' });
    });
    it('cursors round-trip and reject junk', () => {
        const c = encodeCursor({ created_at: '2026-10-19T01:02:03.000Z', id: 'aud_1' });
        expect(decodeCursor(c)).toEqual({ t: '2026-10-19T01:02:03.000Z', id: 'aud_1' });
        expect(decodeCursor('nope')).toBeNull();
        expect(decodeCursor(Buffer.from("x|'; drop").toString('base64url'))).toBeNull();
    });
});

describe('GET /api/audit', () => {
    it('is paid only', async () => {
        const r = await call(t.free);
        expect(r.status).toBe(403);
        expect((await r.json()).upgrade).toMatch(/paid plans/);
    });

    it('shows only this org, inside the plan period, without internal entries, newest first', async () => {
        await entry(t.starter.orgId, { actor: t.starter.user.id, action: 'create', diff: { name: 'Hero test' }, at: ago(1) });
        await entry(t.starter.orgId, { actor: t.starter.user.id, action: 'status:running', at: ago(0.5) });
        await entry(t.starter.orgId, { actor: t.starter.user.id, action: 'update', at: ago(95) }); // past 90 days
        await entry(t.starter.orgId, { entity: 'abuse', action: 'abuse:domain_reuse', at: ago(0.2) });
        await entry(t.starter.orgId, { entity: 'organization', action: 'admin:special_friend', actor: t.growth.user.id, at: ago(0.1) });
        await entry(t.growth.orgId, { actor: t.growth.user.id, action: 'create', at: ago(0.1) });
        const j = await (await call(t.starter)).json();
        expect(j.retention_days).toBe(90);
        // The workspace setup entry (organization created) is listed too.
        expect(j.entries.map((e: { label: string }) => e.label)).toEqual(['Organization created', 'Test started', 'Test created']);
        expect(j.entries[2]).toMatchObject({ actor: { kind: 'member', name: 'starter' }, details: 'name: Hero test' });
        expect(j.next_cursor).toBeNull();
        const g = await (await call(t.growth)).json();
        expect(g.retention_days).toBe(365);
        expect(g.entries).toHaveLength(2);
    });

    it('filters by type and pages with a cursor', async () => {
        for (let i = 0; i < AUDIT_PAGE_SIZE + 5; i++) await entry(t.ent.orgId, { actor: t.ent.user.id, entity: i % 2 ? 'survey' : 'popup', action: 'update', at: ago(2 + i / 100), id: `aud_p${String(i).padStart(3, '0')}` });
        const first = await (await call(t.ent)).json();
        expect(first.entries).toHaveLength(AUDIT_PAGE_SIZE);
        const second = await (await call(t.ent, `cursor=${first.next_cursor}`)).json();
        expect(second.entries).toHaveLength(6); // plus the organization created entry
        expect(new Set([...first.entries, ...second.entries].map((e: { id: string }) => e.id)).size).toBe(AUDIT_PAGE_SIZE + 6);
        const surveys = await (await call(t.ent, 'entity=survey')).json();
        expect(surveys.entries.every((e: { entity: string }) => e.entity === 'survey')).toBe(true);
        expect((await (await call(t.ent, 'entity=abuse')).json()).entity).toBeNull();
    });
});

describe('audit retention', () => {
    it('deletes entries past each plan period and keeps the rest', async () => {
        const d = await getDb();
        await entry(t.free.orgId, { at: ago(31), id: 'aud_free_old' });
        await entry(t.free.orgId, { at: ago(29), id: 'aud_free_new' });
        await entry(t.growth.orgId, { at: ago(364), id: 'aud_g_keep' });
        await entry(t.growth.orgId, { at: ago(366), id: 'aud_g_old' });
        await entry(t.ent.orgId, { at: ago(700), id: 'aud_e_keep' });
        await entry(t.ent.orgId, { at: ago(731), id: 'aud_e_old' });
        const c = retentionCutoffs();
        expect(Object.keys(c.auditBefore)).toEqual(['free', 'starter', 'growth', 'enterprise']);
        const r = await runRetention(new Date(Date.now() + 1000));
        expect(r?.auditEntries).toBe(4); // free 31d, starter 95d, growth 366d, enterprise 731d
        const ids = (await d.all<{ id: string }>(sql`select id from audit_log`)).map((x) => x.id);
        expect(ids).toEqual(expect.arrayContaining(['aud_free_new', 'aud_g_keep', 'aud_e_keep']));
        expect(ids).not.toContain('aud_free_old');
        expect(ids).not.toContain('aud_g_old');
        expect(ids).not.toContain('aud_e_old');
    });
});

describe('public copy', () => {
    it('pricing matches the enforced periods and the view is paid only', async () => {
        const fs = await import('node:fs');
        const pricing = fs.readFileSync('app/pricing/page.tsx', 'utf8');
        expect(pricing).toContain("['Audit log', 'Not included (paid plans only)', '90 days', '1 year', '2 years']");
        expect(pricing).not.toContain("'Custom'],\n    ['Support'");
        expect(fs.readFileSync('lib/docs/content/experiments.ts', 'utf8')).not.toContain('coming later.');
    });
});

describe('pricing feature list', () => {
    it('marks paid features as not included on lower plans', async () => {
        const fs = await import('node:fs');
        const pricing = fs.readFileSync('app/pricing/page.tsx', 'utf8');
        for (const m of pricing.matchAll(/\{ name: '([^']*)', tier: (\d) \}/g)) {
            if (/paid plans/.test(m[1])) expect(m[2], m[1]).toBe('1');
            if (/Growth and above/.test(m[1])) expect(m[2], m[1]).toBe('2');
        }
        expect(pricing).not.toContain('Available today on all plans');
        expect(pricing).toMatch(/i >= f\.tier \? <Check \/>/);
    });
});
