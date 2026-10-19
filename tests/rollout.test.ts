import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { NextRequest } from 'next/server';
import { sql } from 'drizzle-orm';
import { useTempDatabase, seedProjectDomain, flowExperimentBody } from './helpers';
import { rolloutReply, rolloutVariation } from '@/lib/rollout';
import type { Experiment, Variation } from '@/lib/types';

const session = vi.hoisted(() => ({ current: null as null | { user: { id: string } } }));
vi.mock('next-auth', () => ({ getServerSession: vi.fn(async () => session.current) }));

import { db } from '@/lib/db';
import { getDb } from '@/lib/db/client';
import { clearConfigCache } from '@/lib/configCache';
import { POST as create } from '@/app/api/experiments/route';
import { PATCH as patch } from '@/app/api/experiments/[id]/route';
import { POST as bootstrap } from '@/app/api/sdk/bootstrap/route';
import { POST as assign } from '@/app/api/assign/route';
import { POST as rollout, DELETE as stopRollout } from '@/app/api/experiments/[id]/rollout/route';

const json = (method: string, url: string, body?: unknown, headers: Record<string, string> = {}) =>
    new NextRequest(`http://localhost${url}`, {
        method,
        headers: { 'Content-Type': 'application/json', Origin: 'http://localhost', ...headers },
        body: body === undefined ? undefined : JSON.stringify(body),
    });
const p = (id: string) => ({ params: Promise.resolve({ id }) });
const CONTROL = 'http://localhost/demo/control.html';
const VARIANT = 'http://localhost/demo/variation.html';

describe('rollout reply', () => {
    const v = (id: string, extra: Partial<Variation>) => ({ id, name: id, is_control: false, url: null, changes: null, ...extra }) as Variation;
    const exp = (extra: Partial<Experiment>) => ({ id: 'e', status: 'completed', control_url: CONTROL, targeting: null, rollout_variation_id: 'b', ...extra }) as Experiment;
    const ctx = (url: string) => ({ url, userAgent: 'Mozilla/5.0 (Windows NT 10.0) Chrome/126.0' });
    const control = v('c', { is_control: true, url: CONTROL });

    it('sends everyone to a URL winner and stays on it, without counting', () => {
        const vars = [control, v('b', { url: VARIANT })];
        expect(rolloutReply(exp({}), vars, ctx(CONTROL))).toMatchObject({ matched: false, action: 'redirect', variation_url: VARIANT, reason: 'rollout' });
        expect(rolloutReply(exp({}), vars, ctx(VARIANT))).toMatchObject({ matched: false, action: 'none', reason: 'rollout' });
    });
    it('applies a visual winner on the control page and sends the control back home', () => {
        const changes = JSON.stringify([{ selector: 'h1', action: 'text', value: 'New' }]);
        const vars = [control, v('b', { changes }), v('x', { url: VARIANT })];
        const r = rolloutReply(exp({}), vars, ctx(CONTROL));
        expect(r).toMatchObject({ matched: false, action: 'stay', variation_id: 'b' });
        expect(r.changes).toHaveLength(1);
        expect(rolloutReply(exp({}), vars, ctx(VARIANT))).toMatchObject({ action: 'redirect', variation_url: CONTROL });
        expect(rolloutReply(exp({ rollout_variation_id: 'c' }), vars, ctx(VARIANT))).toMatchObject({ action: 'redirect', variation_url: CONTROL });
        expect(rolloutReply(exp({ rollout_variation_id: 'c' }), vars, ctx(CONTROL))).toMatchObject({ action: 'none' });
    });
    it('respects targeting and ignores a missing or inactive rollout', () => {
        const vars = [control, v('b', { url: VARIANT })];
        const mobileOnly = exp({ targeting: JSON.stringify({ devices: ['mobile'] }) });
        expect(rolloutReply(mobileOnly, vars, ctx(CONTROL))).toMatchObject({ action: 'none', reason: 'not_targeted' });
        expect(rolloutVariation(exp({ status: 'running' }), vars)).toBeNull();
        expect(rolloutVariation(exp({ rollout_variation_id: 'gone' }), vars)).toBeNull();
        expect(rolloutReply(exp({ rollout_variation_id: null }), vars, ctx(CONTROL)).action).toBe('none');
    });
});

describe('rollout end to end', () => {
    let cleanup: () => void;
    let expId = '', userId = '', sdkKey = '', otherUser = '', variantId = '';
    const boot = (user: string, url = CONTROL) => bootstrap(json('POST', '/api/sdk/bootstrap', { url, user_id: user }, { 'X-API-Key': sdkKey }));
    const counts = async () => {
        const d = await getDb();
        const [a] = await d.all<{ n: number }>(sql`select count(*) as n from assignments where experiment_id = ${expId}`);
        const [e] = await d.all<{ n: number }>(sql`select count(*) as n from events where experiment_id = ${expId}`);
        return { assignments: Number(a.n), events: Number(e.n) };
    };

    beforeAll(async () => {
        cleanup = useTempDatabase();
        const u = await db.createUser({ email: 'roll@example.com', name: 'Roll' });
        userId = u.id;
        const ws = await db.ensureWorkspace(u);
        await seedProjectDomain(ws.projectId, 'localhost');
        const env = (await db.getEnvironments(ws.projectId)).find((e) => e.key === 'dev')!;
        sdkKey = (await db.createApiKey({ environmentId: env.id, type: 'sdk' })).key;
        session.current = { user: { id: u.id } };
        const data = await (await create(json('POST', '/api/experiments', flowExperimentBody()))).json();
        expId = data.experiment.id;
        variantId = data.variations.find((v: { is_control: boolean }) => !v.is_control).id;
        otherUser = (await db.createUser({ email: 'other@example.com', name: 'Other' })).id;
        await db.ensureWorkspace({ id: otherUser, email: 'other@example.com' } as never);
        clearConfigCache();
    });
    afterAll(() => cleanup());

    it('cannot roll out a draft, an unknown variation or someone else\'s test', async () => {
        session.current = { user: { id: userId } };
        expect((await rollout(json('POST', `/api/experiments/${expId}/rollout`, { variation_id: variantId }), p(expId))).status).toBe(400);
        await patch(json('PATCH', `/api/experiments/${expId}`, { status: 'running' }), p(expId));
        expect((await rollout(json('POST', `/api/experiments/${expId}/rollout`, { variation_id: 'var_nope' }), p(expId))).status).toBe(404);
        session.current = { user: { id: otherUser } };
        expect((await rollout(json('POST', `/api/experiments/${expId}/rollout`, { variation_id: variantId }), p(expId))).status).toBe(404);
        session.current = null;
        expect((await rollout(json('POST', `/api/experiments/${expId}/rollout`, { variation_id: variantId }), p(expId))).status).toBe(401);
    });

    it('stops the test, sends every visitor to the winner and records nothing', async () => {
        await boot('before');
        const before = await counts();
        session.current = { user: { id: userId } };
        const res = await rollout(json('POST', `/api/experiments/${expId}/rollout`, { variation_id: variantId }), p(expId));
        expect(res.status).toBe(200);
        const { experiment } = await res.json();
        expect(experiment.status).toBe('completed');
        expect(experiment.rollout_variation_id).toBe(variantId);
        expect(experiment.ended_at).toBeTruthy();

        for (const user of ['new1', 'new2', 'before']) {
            const r = await (await boot(user)).json();
            expect(r).toMatchObject({ matched: false, action: 'redirect', variation_id: variantId, variation_url: VARIANT, reason: 'rollout' });
        }
        expect((await (await boot('new1', VARIANT)).json())).toMatchObject({ matched: false, action: 'none', reason: 'rollout' });
        const a = await (await assign(json('POST', '/api/assign', { experiment_id: expId, user_id: 'srv1' }, { 'X-API-Key': sdkKey }))).json();
        expect(a).toMatchObject({ variation_id: variantId, assigned: false, reason: 'rollout' });
        expect(await counts()).toEqual(before);

        const d = await getDb();
        const actions = (await d.all<{ action: string }>(sql`select action from audit_log where entity_id = ${expId} order by created_at`)).map((x) => x.action);
        expect(actions).toContain('rollout:start');
    });

    it('can switch the rolled-out version, then stop the rollout', async () => {
        const vars = await db.getVariations(expId);
        const control = vars.find((v) => v.is_control)!;
        expect((await rollout(json('POST', `/api/experiments/${expId}/rollout`, { variation_id: control.id }), p(expId))).status).toBe(200);
        expect(await (await boot('x', VARIANT)).json()).toMatchObject({ action: 'redirect', variation_url: CONTROL });
        const res = await stopRollout(json('DELETE', `/api/experiments/${expId}/rollout`), p(expId));
        expect((await res.json()).experiment.rollout_variation_id).toBeNull();
        expect(await (await boot('x')).json()).toMatchObject({ matched: false, action: 'none', reason: 'no_match' });
        const d = await getDb();
        const actions = (await d.all<{ action: string }>(sql`select action from audit_log where entity_id = ${expId}`)).map((x) => x.action);
        expect(actions).toContain('rollout:stop');
    });
});

describe('rollout wiring', () => {
    const root = path.join(__dirname, '..');
    const read = (f: string) => fs.readFileSync(path.join(root, f), 'utf8');
    it('migration adds the rollout columns with a newer timestamp', () => {
        const j = JSON.parse(read('drizzle/meta/_journal.json')) as { entries: { tag: string; when: number }[] };
        const i = j.entries.findIndex((e) => e.tag === '0032_experiment_rollout');
        expect(i).toBeGreaterThan(0);
        expect(j.entries[i].when).toBeGreaterThan(j.entries[i - 1].when);
    });
    it('the SDK skips tracking for replies that are not matched', () => {
        expect(read('sdk-src/sdk.js')).toMatch(/if \(data\.matched && data\.variation_id && data\.action !== 'guard'\)/);
    });
    it('docs no longer list one-click rollout as coming later', () => {
        expect(read('lib/docs/content/winners.ts')).not.toMatch(/ship winner/);
        expect(read('app/pricing/page.tsx')).toMatch(/Roll out the winner/);
    });
});
