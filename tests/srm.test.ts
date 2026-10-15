import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { useTempDatabase, seedProjectDomain, flowExperimentBody } from './helpers';
import { chiSquarePValue, sampleRatioMismatch } from '@/lib/statistics';

const session = vi.hoisted(() => ({ current: null as null | { user: { id: string } } }));
vi.mock('next-auth', () => ({ getServerSession: vi.fn(async () => session.current) }));

import { db } from '@/lib/db';
import { POST as create } from '@/app/api/experiments/route';
import { GET as results } from '@/app/api/experiments/[id]/results/route';

describe('chi-square', () => {
    it('matches known critical values', () => {
        expect(chiSquarePValue(3.841, 1)).toBeCloseTo(0.05, 3);
        expect(chiSquarePValue(10.828, 1)).toBeCloseTo(0.001, 4);
        expect(chiSquarePValue(5.991, 2)).toBeCloseTo(0.05, 3);
        expect(chiSquarePValue(0, 3)).toBe(1);
        expect(chiSquarePValue(200, 1)).toBeLessThan(1e-10);
    });
});

describe('sampleRatioMismatch', () => {
    it('does not flag a normal 50/50 split', () => {
        expect(sampleRatioMismatch([5020, 4980], [50, 50]).mismatch).toBe(false);
    });
    it('flags a clear mismatch', () => {
        const r = sampleRatioMismatch([5500, 4500], [50, 50]);
        expect(r.mismatch).toBe(true);
        expect(r.p_value).toBeLessThan(0.001);
    });
    it('respects weights and small samples', () => {
        expect(sampleRatioMismatch([900, 100], [90, 10]).mismatch).toBe(false);
        expect(sampleRatioMismatch([40, 10], [50, 50]).mismatch).toBe(false); // under 100 visitors
        expect(sampleRatioMismatch([0, 0], [50, 50]).p_value).toBe(1);
    });
});

describe('results API includes SRM', () => {
    let cleanup: () => void;
    beforeAll(async () => { cleanup = useTempDatabase(); });
    afterAll(() => cleanup());

    it('reports a mismatch from enrolled visitors', async () => {
        const u = await db.createUser({ email: 's@example.com', name: 'S' });
        const ws = await db.ensureWorkspace(u);
        await seedProjectDomain(ws.projectId, 'localhost');
        session.current = { user: { id: u.id } };
        const res = await create(new NextRequest('http://localhost/api/experiments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(flowExperimentBody()) }));
        const { experiment, variations } = await res.json();
        const [c, v] = variations;
        for (let i = 0; i < 300; i++) await db.createAssignment({ experiment_id: experiment.id, variation_id: i < 220 ? c.id : v.id, user_id: `u${i}` });
        await db.updateExperiment(experiment.id, { status: 'running' });
        const r = await (await results(new NextRequest(`http://localhost/api/experiments/${experiment.id}/results`), { params: Promise.resolve({ id: experiment.id }) })).json();
        expect(r.srm.mismatch).toBe(true);
        expect(r.srm.total).toBe(300);
        expect(r.srm.variations.map((x: { observed: number }) => x.observed)).toEqual([220, 80]);
    });
});
