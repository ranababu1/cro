import { describe, it, expect } from 'vitest';
import fs from 'node:fs';

// Public copy must never show a planned feature as available.
const roadmap = fs.readFileSync('app/roadmap/page.tsx', 'utf8');
const pricing = fs.readFileSync('app/pricing/page.tsx', 'utf8');
const phases = [...roadmap.matchAll(/\{ phase: 'Phase (\d+)', name: '([^']+)', status: '([^']+)', items: \[([^\]]*)\] \}/g)]
    .map((m) => ({ n: Number(m[1]), name: m[2], status: m[3], items: [...m[4].matchAll(/'([^']+)'/g)].map((x) => x[1]) }));

describe('claims audit', () => {
    it('parses every roadmap phase', () => {
        expect(phases.map((p) => p.n)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    });
    it('session recordings are planned, and never inside a Done phase', () => {
        for (const p of phases.filter((x) => x.status === 'Done')) {
            for (const i of p.items) expect(i, `${p.name}: ${i}`).not.toMatch(/recording/i);
        }
        expect(phases.find((p) => p.items.some((i) => /recording/i.test(i)))?.status).toBe('Planned');
    });
    it('each coming soon pricing row points at a roadmap phase that is not Done and lists it', () => {
        const rows = [...pricing.matchAll(/\{ name: '([^']+)', p: (\d+), tier: \d \}/g)].map((m) => ({ name: m[1], p: Number(m[2]) }));
        expect(rows.length).toBeGreaterThan(0);
        for (const r of rows) {
            const phase = phases.find((p) => p.n === r.p)!;
            expect(phase, r.name).toBeTruthy();
            expect(phase.status).not.toBe('Done');
            expect(phase.items.join(' ').toLowerCase()).toContain(r.name.toLowerCase());
        }
    });
    it('does not state a fixed number of phases', () => {
        expect(roadmap).not.toMatch(/\b(five|six|seven) phases\b/i);
    });
});
