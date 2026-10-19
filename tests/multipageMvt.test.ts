import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { useTempDatabase, seedProjectDomain, flowExperimentBody } from './helpers';

const session = vi.hoisted(() => ({ current: null as null | { user: { id: string } } }));
vi.mock('next-auth', () => ({ getServerSession: vi.fn(async () => session.current) }));

import { db } from '@/lib/db';
import { clearConfigCache } from '@/lib/configCache';
import { POST as create } from '@/app/api/experiments/route';
import { PATCH as patchExperiment } from '@/app/api/experiments/[id]/route';
import { GET as getPages, PUT as putPages } from '@/app/api/experiments/[id]/pages/route';
import { GET as getMvt, POST as buildMvt, DELETE as undoMvt } from '@/app/api/experiments/[id]/mvt/route';
import { PUT as putChanges } from '@/app/api/experiments/[id]/variations/[variationId]/changes/route';
import { POST as bootstrap } from '@/app/api/sdk/bootstrap/route';
import { buildCombos, buildMvtSchema, combinations, comboChanges, comboName, evenWeights, factorEffects, parseMvt, type MvtConfig } from '@/lib/mvt';
import { onTestPage, parsePages, pagesSchema } from '@/lib/multipage';
import { rolloutReply } from '@/lib/rollout';
import type { Experiment, Variation } from '@/lib/types';

const json = (method: string, url: string, body?: unknown, headers: Record<string, string> = {}) =>
    new NextRequest(`http://localhost${url}`, { method, headers: { 'Content-Type': 'application/json', Origin: 'http://localhost', ...headers }, body: body === undefined ? undefined : JSON.stringify(body) });
const p = (id: string) => ({ params: Promise.resolve({ id }) });

const CONTROL = 'http://localhost/shop/index.html';
const visualBody = () => flowExperimentBody({
    control_url: CONTROL,
    variations: [
        { name: 'Control', url: CONTROL, weight: 25, is_control: true },
        { name: 'Headline B', weight: 25, is_control: false },
        { name: 'Green button', weight: 25, is_control: false },
        { name: 'Short form', weight: 25, is_control: false },
    ],
});

describe('multivariate math', () => {
    const config: MvtConfig = {
        factors: [
            { name: 'Headline', levels: [{ name: 'Original', changes: [] }, { name: 'Headline B', changes: [{ selector: 'h1', action: 'text', value: 'B' }] }, { name: 'Headline C', changes: [{ selector: 'h1', action: 'text', value: 'C' }] }] },
            { name: 'Button', levels: [{ name: 'Original', changes: [] }, { name: 'Green', changes: [{ selector: 'page', action: 'css', value: '.cta{color:green}' }] }] },
        ],
    };
    it('lists every combination, all originals first', () => {
        expect(combinations([3, 2])).toEqual([[0, 0], [0, 1], [1, 0], [1, 1], [2, 0], [2, 1]]);
        expect(combinations([2, 2, 2])).toHaveLength(8);
    });
    it('splits weights into whole numbers that add up to 100', () => {
        for (const n of [2, 3, 4, 6, 7, 8, 9, 12, 18]) {
            const w = evenWeights(n);
            expect(w.reduce((a, b) => a + b, 0)).toBe(100);
            expect(Math.max(...w) - Math.min(...w)).toBeLessThanOrEqual(1);
        }
    });
    it('names and merges combinations, joining page CSS into one block', () => {
        expect(comboName(config, [0, 0])).toBe('Control');
        expect(comboName(config, [2, 1])).toBe('Headline C + Green');
        const twoCss: MvtConfig = { factors: [config.factors[1], { name: 'Font', levels: [{ name: 'Original', changes: [] }, { name: 'Big', changes: [{ selector: 'page', action: 'css', value: 'body{font-size:18px}' }] }] }] };
        const merged = comboChanges(twoCss, [1, 1]);
        expect(Array.isArray(merged) && merged.filter((c) => c.action === 'css')).toHaveLength(1);
        const combos = buildCombos(config);
        expect('error' in combos).toBe(false);
        if (!('error' in combos)) {
            expect(combos).toHaveLength(6);
            expect(combos.filter((c) => c.is_control)).toHaveLength(1);
            expect(combos[5].changes).toHaveLength(2);
        }
    });
    it('caps factors, versions and combinations', () => {
        const f = (n: number, name: string) => ({ name, variation_ids: Array.from({ length: n }, (_, i) => `${name}${i}`) });
        expect(buildMvtSchema.safeParse({ factors: [f(1, 'a')] }).success).toBe(false);
        expect(buildMvtSchema.safeParse({ factors: [f(1, 'a'), f(1, 'b')] }).success).toBe(true);
        expect(buildMvtSchema.safeParse({ factors: [f(3, 'a'), f(1, 'b')] }).success).toBe(false);
        expect(buildMvtSchema.safeParse({ factors: [f(2, 'a'), f(2, 'b'), f(1, 'c')] }).success).toBe(true);
        const tooMany = buildMvtSchema.safeParse({ factors: [f(2, 'a'), f(2, 'b'), f(2, 'c')] });
        expect(tooMany.success).toBe(false);
        expect(JSON.stringify(tooMany.error?.issues)).toMatch(/27 combinations/);
        expect(buildMvtSchema.safeParse({ factors: [{ name: 'x', variation_ids: ['1'] }, { name: 'X', variation_ids: ['2'] }] }).success).toBe(false);
        expect(buildMvtSchema.safeParse({ factors: [{ name: 'x', variation_ids: ['1'] }, { name: 'y', variation_ids: ['1'] }] }).success).toBe(false);
    });
    it('sums each level over the combinations that use it', () => {
        const vs = [[0, 0], [0, 1], [1, 0], [1, 1]].map((c, i) => ({ id: `v${i}`, combo: JSON.stringify(c) }));
        const two: MvtConfig = { factors: [{ name: 'A', levels: [{ name: 'Original', changes: [] }, { name: 'A1', changes: [] }] }, { name: 'B', levels: [{ name: 'Original', changes: [] }, { name: 'B1', changes: [] }] }] };
        const res = [
            { variation_id: 'v0', total_users: 100, conversions: 10 },
            { variation_id: 'v1', total_users: 100, conversions: 10 },
            { variation_id: 'v2', total_users: 100, conversions: 20 },
            { variation_id: 'v3', total_users: 100, conversions: 20 },
        ];
        const [a, b] = factorEffects(two, vs, res);
        expect(a[0]).toMatchObject({ visitors: 200, conversions: 20, lift: null });
        expect(a[1]).toMatchObject({ visitors: 200, conversions: 40 });
        expect(a[1].lift).toBeCloseTo(1);
        expect(b[1].lift).toBeCloseTo(0);
    });
});

describe('page rules', () => {
    it('match the control page and the extra pages', () => {
        const e = { control_url: CONTROL, pages: JSON.stringify([{ match: 'starts_with', value: '/shop/item' }, { match: 'contains', value: 'sale' }]) };
        expect(onTestPage(e, CONTROL, CONTROL)).toBe(true);
        expect(onTestPage(e, CONTROL, 'http://localhost/shop/item/42?x=1')).toBe(true);
        expect(onTestPage(e, CONTROL, 'http://localhost/summer-sale')).toBe(true);
        expect(onTestPage(e, CONTROL, 'http://localhost/about')).toBe(false);
        expect(parsePages('not json')).toEqual([]);
        expect(pagesSchema.safeParse({ pages: Array.from({ length: 11 }, () => ({ match: 'contains', value: 'x' })) }).success).toBe(false);
    });
    it('keep a rolled-out visual winner on extra pages instead of redirecting', () => {
        const exp = { id: 'e', control_url: CONTROL, pages: JSON.stringify([{ match: 'starts_with', value: '/shop/item' }]), targeting: null, status: 'completed', rollout_variation_id: 'b' } as unknown as Experiment;
        const vs = [{ id: 'a', is_control: true, url: CONTROL, changes: null }, { id: 'b', is_control: false, url: null, changes: JSON.stringify([{ selector: 'h1', action: 'text', value: 'Hi' }]) }] as unknown as Variation[];
        const ctx = { url: 'http://localhost/shop/item/7', userAgent: null, referrer: null, visitorType: null };
        expect(rolloutReply(exp, vs, ctx)).toMatchObject({ action: 'stay', changes: [{ selector: 'h1' }] });
        expect(rolloutReply(exp, vs, { ...ctx, url: 'http://localhost/about' })).toMatchObject({ action: 'redirect' });
    });
});

describe('routes', () => {
    let cleanup: () => void;
    const t: Record<string, { userId: string; expId: string; sdkKey: string; vars: Variation[] }> = {};
    async function tenant(name: string, plan: string, body = visualBody()) {
        const u = await db.createUser({ email: `${name}@example.com`, name });
        const ws = await db.ensureWorkspace(u);
        // Created on Growth (visual variations need it), then moved to the plan under test.
        await db.updateOrganization(ws.orgId, { plan: 'growth' });
        await seedProjectDomain(ws.projectId, 'localhost');
        const env = (await db.getEnvironments(ws.projectId)).find((e) => e.key === 'dev')!;
        const sdkKey = (await db.createApiKey({ environmentId: env.id, type: 'sdk' })).key;
        session.current = { user: { id: u.id } };
        const data = await (await create(json('POST', '/api/experiments', body))).json();
        if (!data.experiment) throw new Error(JSON.stringify(data));
        const expId = data.experiment.id as string;
        const vars = await db.getVariations(expId);
        for (const v of vars.filter((x) => !x.is_control)) await db.setVariationChanges(expId, v.id, JSON.stringify([{ selector: `.${v.name.replace(/\s/g, '')}`, action: 'text', value: v.name }]));
        await db.updateOrganization(ws.orgId, { plan });
        return { userId: u.id, expId, sdkKey, vars: await db.getVariations(expId) };
    }
    const as = (k: string) => { session.current = { user: { id: t[k].userId } }; };
    beforeAll(async () => {
        cleanup = useTempDatabase();
        t.starter = await tenant('mstarter', 'starter');
        t.growth = await tenant('mgrowth', 'growth');
        t.split = await tenant('msplit', 'growth', flowExperimentBody());
        clearConfigCache();
    });
    afterAll(() => cleanup());

    it('pages need Growth and a visual test', async () => {
        as('starter');
        const g = await (await getPages(json('GET', '/x'), p(t.starter.expId))).json();
        expect(g).toMatchObject({ allowed: false, visual: true, pages: [] });
        expect((await putPages(json('PUT', '/x', { pages: [{ match: 'contains', value: '/item' }] }), p(t.starter.expId))).status).toBe(403);
        expect((await putPages(json('PUT', '/x', { pages: [] }), p(t.starter.expId))).status).toBe(200);
        as('split');
        const s = await putPages(json('PUT', '/x', { pages: [{ match: 'contains', value: '/item' }] }), p(t.split.expId));
        expect(s.status).toBe(400);
        as('growth');
        expect((await putPages(json('PUT', '/x', { pages: [{ match: 'bogus', value: '/item' }] }), p(t.growth.expId))).status).toBe(400);
        expect((await putPages(json('PUT', '/x', { pages: [{ match: 'contains', value: '/x' }] }), p(t.starter.expId))).status).toBe(404);
    });

    it('builds combinations from visual variations on a Growth draft and can undo them', async () => {
        as('starter');
        const vs = t.starter.vars.filter((v) => !v.is_control);
        expect((await buildMvt(json('POST', '/x', { factors: [{ name: 'A', variation_ids: [vs[0].id] }, { name: 'B', variation_ids: [vs[1].id] }] }), p(t.starter.expId))).status).toBe(403);
        expect((await (await getMvt(json('GET', '/x'), p(t.starter.expId))).json()).allowed).toBe(false);

        as('growth');
        const g = t.growth.vars.filter((v) => !v.is_control);
        const res = await buildMvt(json('POST', '/x', { factors: [{ name: 'Headline', variation_ids: [g[0].id] }, { name: 'Button', variation_ids: [g[1].id, g[2].id] }] }), p(t.growth.expId));
        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.variations).toHaveLength(6);
        expect(data.variations.reduce((s: number, v: Variation) => s + v.weight, 0)).toBe(100);
        const control = data.variations.find((v: Variation) => v.is_control);
        expect(control.url).toBe(CONTROL);
        expect(control.changes).toBeNull();
        const both = data.variations.find((v: Variation) => v.name.includes(' + '));
        if (!both) throw new Error(data.variations.map((v: Variation) => v.name).join('|'));
        expect(JSON.parse(both.changes)).toHaveLength(2);
        expect(parseMvt(data.experiment.mvt)?.factors.map((f) => f.levels.length)).toEqual([2, 3]);
        // Combinations are not edited one by one.
        const edit = await putChanges(json('PUT', '/x', { changes: [] }), { params: Promise.resolve({ id: t.growth.expId, variationId: both.id }) });
        expect(edit.status).toBe(400);
        // Building again needs an undo first.
        expect((await buildMvt(json('POST', '/x', { factors: [{ name: 'A', variation_ids: [both.id] }, { name: 'B', variation_ids: [control.id] }] }), p(t.growth.expId))).status).toBe(400);

        const undo = await (await undoMvt(json('DELETE', '/x'), p(t.growth.expId))).json();
        expect(undo.variations[0].name).toBe('Control');
        expect(undo.variations.map((v: Variation) => v.name).sort()).toEqual(['Control', 'Green button', 'Headline B', 'Short form']);
        expect(undo.variations.slice(1).map((v: Variation) => v.name)).toEqual([g[0].name, g[1].name, g[2].name]);
        expect(undo.experiment.mvt).toBeNull();
        expect(undo.variations.reduce((s: number, v: Variation) => s + v.weight, 0)).toBe(100);
        for (const v of undo.variations.slice(1)) expect(JSON.parse(v.changes)[0]).toMatchObject({ value: v.name });
    });

    it('refuses split URL variations and running tests', async () => {
        as('split');
        const v = t.split.vars.find((x) => !x.is_control)!;
        const r = await buildMvt(json('POST', '/x', { factors: [{ name: 'A', variation_ids: [v.id] }, { name: 'B', variation_ids: [t.split.vars[0].id] }] }), p(t.split.expId));
        expect(r.status).toBe(400);
    });

    it('a running multi-page multivariate test applies its changes on every page in the test', async () => {
        as('growth');
        const g = (await db.getVariations(t.growth.expId)).filter((v) => !v.is_control);
        await buildMvt(json('POST', '/x', { factors: [{ name: 'Headline', variation_ids: [g[0].id] }, { name: 'Button', variation_ids: [g[1].id] }] }), p(t.growth.expId));
        const put = await putPages(json('PUT', '/x', { pages: [{ match: 'starts_with', value: '/shop/item' }] }), p(t.growth.expId));
        expect(put.status).toBe(200);
        expect((await patchExperiment(json('PATCH', '/x', { status: 'running' }), p(t.growth.expId))).status).toBe(200);
        clearConfigCache();
        const boot = (user: string, url: string) => bootstrap(json('POST', '/api/sdk/bootstrap', { url, user_id: user }, { 'X-API-Key': t.growth.sdkKey }));
        let seen = 0;
        for (let i = 0; i < 40; i++) {
            const user = `mv-${i}`;
            const a = await (await boot(user, CONTROL)).json();
            const b = await (await boot(user, 'http://localhost/shop/item/9')).json();
            expect(a.matched).toBe(true);
            expect(b.variation_id).toBe(a.variation_id);
            expect(b.changes ?? []).toEqual(a.changes ?? []);
            if (a.changes?.length) seen++;
        }
        expect(seen).toBeGreaterThan(10);
        const off = await (await boot('mv-0', 'http://localhost/about')).json();
        expect(off.matched).toBe(false);
        // Undo is for drafts only.
        expect((await undoMvt(json('DELETE', '/x'), p(t.growth.expId))).status).toBe(400);
    });
});
