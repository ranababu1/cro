import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { sql } from 'drizzle-orm';
import { useTempDatabase } from './helpers';

const session = vi.hoisted(() => ({ current: null as null | { user: { id: string; email: string } } }));
vi.mock('next-auth', () => ({ getServerSession: vi.fn(async () => session.current) }));

import { db, getDb } from '@/lib/db';
import { generateId } from '@/lib/ids';
import { resultsCsv, csvCell, RESULTS_CSV_HEADER } from '@/lib/resultsCsv';
import { buildExperimentResults } from '@/lib/results';
import { GET as exportCsv } from '@/app/api/experiments/[id]/results/export/route';

let cleanup: () => void;
let exp = '';
let goal = '';
let ctl = '';
let b = '';
const u = { id: '', email: 'csv@example.com' };

const parse = (csv: string) => {
    const [head, ...lines] = csv.trim().split('\n');
    const keys = head.split(',');
    return lines.map((l) => Object.fromEntries(l.split(',').map((v, i) => [keys[i], v])));
};

beforeAll(async () => {
    cleanup = useTempDatabase();
    const user = await db.createUser({ email: u.email, name: 'CSV' });
    u.id = user.id;
    const ws = await db.ensureWorkspace(user);
    exp = generateId('exp');
    await db.createExperiment({ id: exp, project_id: ws.projectId, user_id: user.id, name: 'Pricing, annual first', status: 'running', traffic_allocation: 100, control_url: 'https://example.com/p' },
        [{ name: 'Control', weight: 50, is_control: true, url: 'https://example.com/p' }, { name: '=Annual', weight: 50, is_control: false, url: 'https://example.com/p2' }]);
    const vars = await db.getVariations(exp);
    ctl = vars.find((v) => v.is_control)!.id;
    b = vars.find((v) => !v.is_control)!.id;
    const d = await getDb();
    goal = generateId('goal');
    await d.run(sql`insert into goals (id, experiment_id, name, selector, is_primary) values (${goal}, ${exp}, 'Buy', '#buy', 1)`);
    // Day 1 and day 2 in the past (rolled up), plus today (raw). Visitor c1 returns on day 2 and converts then.
    const ev = (user: string, variation: string, type: string, at: string, goalId: string | null = null) =>
        d.run(sql`insert into events (id, experiment_id, variation_id, user_id, event_type, goal_id, created_at) values (${generateId('evt')}, ${exp}, ${variation}, ${user}, ${type}, ${goalId}, ${at})`);
    await ev('c1', ctl, 'page_view', '2026-01-01T10:00:00.000Z');
    await ev('c2', ctl, 'page_view', '2026-01-01T11:00:00.000Z');
    await ev('b1', b, 'page_view', '2026-01-01T12:00:00.000Z');
    await ev('b1', b, 'conversion', '2026-01-01T12:05:00.000Z', goal);
    await ev('c1', ctl, 'page_view', '2026-01-02T09:00:00.000Z');
    await ev('c1', ctl, 'conversion', '2026-01-02T09:01:00.000Z', goal);
    await ev('b2', b, 'page_view', '2026-01-02T10:00:00.000Z');
    const now = new Date().toISOString();
    await ev('c3', ctl, 'page_view', now);
    await ev('b3', b, 'page_view', now);
    await ev('b3', b, 'conversion', now, goal);
});
afterAll(() => cleanup());

describe('results CSV', () => {
    it('one row per day, version and goal, with running totals that match the results table', async () => {
        session.current = { user: u };
        const res = await exportCsv(new NextRequest(`http://localhost/api/experiments/${exp}/results/export`), { params: Promise.resolve({ id: exp }) });
        expect(res.status).toBe(200);
        expect(res.headers.get('Content-Type')).toMatch(/text\/csv/);
        expect(res.headers.get('Content-Disposition')).toMatch(/attachment; filename="results-pricing-annual-first-\d{4}-\d{2}-\d{2}\.csv"/);
        const csv = await res.text();
        expect(csv.split('\n')[0]).toBe(RESULTS_CSV_HEADER.join(','));
        const rows = parse(csv);
        const c = rows.filter((r) => r.variation_id === ctl);
        expect(c.map((r) => [r.date_utc, r.active_visitors, r.new_visitors, r.total_visitors, r.new_converters, r.total_converters])).toEqual([
            ['2026-01-01', '2', '2', '2', '0', '0'],
            ['2026-01-02', '1', '0', '2', '1', '1'],
            [new Date().toISOString().slice(0, 10), '1', '1', '3', '0', '1'],
        ]);
        const last = (id: string) => rows.filter((r) => r.variation_id === id).at(-1)!;
        const results = await buildExperimentResults((await db.getExperiment(exp))!);
        for (const v of results.goals[0].variations) {
            expect(Number(last(v.variation_id).total_visitors)).toBe(v.total_users);
            expect(Number(last(v.variation_id).total_converters)).toBe(v.conversions);
        }
        expect(last(b).conversion_rate_total).toBe((2 / 3).toFixed(6));
        // A name starting with = is not run as a formula.
        expect(csv).toContain(",'=Annual,");
        expect(rows.every((r) => r.goal === 'Buy' && r.goal_id === goal)).toBe(true);
    });

    it('is reached only through the user\'s projects, and audited', async () => {
        const other = await db.createUser({ email: 'csv-other@example.com', name: 'O' });
        await db.ensureWorkspace(other);
        session.current = { user: { id: other.id, email: 'csv-other@example.com' } };
        expect((await exportCsv(new NextRequest(`http://localhost/api/experiments/${exp}/results/export`), { params: Promise.resolve({ id: exp }) })).status).toBe(404);
        session.current = null;
        expect((await exportCsv(new NextRequest(`http://localhost/api/experiments/${exp}/results/export`), { params: Promise.resolve({ id: exp }) })).status).toBe(401);
        const d = await getDb();
        const a = await d.all<{ n: number }>(sql`select count(*) as n from audit_log where action = 'results:export' and entity_id = ${exp}`);
        expect(Number(a[0].n)).toBe(1);
    });

    it('uses all conversions when the test has no named goals, and quotes cells safely', () => {
        const csv = resultsCsv([{ day: '2026-01-01', variation_id: 'v1', bucket: 'v', users: 3 }, { day: '2026-01-01', variation_id: 'v1', bucket: 't:conversion', users: 1 }], [{ id: 'v1', name: 'A, "B"', is_control: true }], []);
        expect(csv).toContain('2026-01-01,"A, ""B""",v1,true,All conversions,,0,3,3,1,1,0.333333');
        expect(csvCell('+1')).toBe("'+1");
        expect(csvCell('@x')).toBe("'@x");
        expect(csvCell(null)).toBe('');
    });
});
