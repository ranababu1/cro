import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { COST_CASES, CONSTANTS, SUMMARY, methodologyExamples } from '@/lib/site/methodology';
import { FEATURE_GROUPS } from '@/lib/site/product';
import { FOOTER_COLUMNS, NAV_MENUS } from '@/app/components/site/nav';
import { getDocPage, blockText } from '@/lib/docs';
import { checkHref, hrefsIn } from './helpers/links';

const read = (f: string) => fs.readFileSync(f, 'utf8');
const page = read('app/statistical-methodology/page.tsx');
const content = read('lib/site/methodology.ts');
const seqSrc = read('lib/sequential.ts');
const statSrc = read('lib/statistics.ts');
const m = methodologyExamples();

describe('statistical methodology page: formulas match the code', () => {
    it('mSPRT: variance, tau, ratio, p-value, Bonferroni and minimum sample', () => {
        expect(seqSrc).toContain('Math.max(p1 * (1 - p1), pooled * (1 - pooled)) / n1 + Math.max(p2 * (1 - p2), pooled * (1 - pooled)) / n2');
        expect(seqSrc).toContain('Math.max(TAU_FLOOR, TAU_RELATIVE * pooled)');
        expect(seqSrc).toContain('0.5 * Math.log(v / (v + t2)) + (t2 * d * d) / (2 * v * (v + t2))');
        expect(seqSrc).toContain('Math.min(1, 1 / msprtRatio(control, variant))');
        expect(seqSrc).toContain('const threshold = alpha / m;');
        expect(CONSTANTS).toMatchObject({ alpha: 0.05, minVisitors: 100, tauRelative: 0.2, tauFloor: 0.002 });
        expect(page).toContain("'Λ  = √( V / (V + τ²) ) × exp( τ²d² / (2V(V + τ²)) )'");
        expect(read('lib/results.ts')).toContain('sequentialTest(control, v, others.length)');
    });

    it('Wilson, chance to beat, Newcombe, SRM, Welch and sample size', () => {
        expect(statSrc).toContain('const center = (p + z * z / (2 * n)) / denominator;');
        expect(statSrc).toContain('const margin = (z / denominator) * Math.sqrt((p * (1 - p) / n) + (z * z / (4 * n * n)));');
        expect(seqSrc).toContain('const a = 1 + Math.max(0, c), b = 1 + Math.max(0, n - c);');
        expect(seqSrc).toContain('normalCDF((y.mean - x.mean) / sd)');
        const live = read('lib/liveStats.ts');
        expect(live).toContain('const lower = diff - Math.sqrt((p2 - c2.lower) ** 2 + (c1.upper - p1) ** 2);');
        expect(live).toContain('const upper = diff + Math.sqrt((c2.upper - p2) ** 2 + (p1 - c1.lower) ** 2);');
        expect(live).toContain('return { lower: lower / p1, upper: upper / p1 };');
        expect(live).toContain('ctlClicks === 0) return null');
        expect(CONSTANTS).toMatchObject({ srmP: 0.001, srmMin: 100, revenueMin: 30 });
        expect(read('lib/results.ts')).toContain('srm: experiment.auto_shift ? undefined');
        const rev = read('lib/revenue.ts');
        expect(rev).toContain('2 * (1 - normalCDF(z))');
        expect(rev).toMatch(/rows: RevenueRow\[\],\n\s+alpha = 0\.05,/);
        expect(statSrc).toContain('(2 * pooledP * (1 - pooledP) * Math.pow(zAlpha + zBeta, 2)) / Math.pow(delta, 2)');
        expect(statSrc).toContain('0.2316419');
        expect(statSrc).toContain('relative error below 1.2e-9');
        expect(read('lib/autoShift.ts')).toContain('const DRAWS = 4000;');
        expect(read('lib/autoShift.ts')).toContain('Math.min(AUTO_SHIFT_FLOOR, Math.floor(50 / Math.max(n, 1)))');
        expect(CONSTANTS).toMatchObject({ shiftMin: 100, shiftFloor: 10, shiftHours: 1 });
    });

    it('auto-shift and revenue plans match the features list', () => {
        const all = FEATURE_GROUPS.flatMap((g) => g.features);
        expect(all.find((f) => /auto-shift/i.test(f.name))?.plan).toBe('Growth and above');
        expect(page).toContain('<PlanBadge plan="Growth and above"');
        expect(page).toContain('<PlanBadge plan="Paid plans"');
    });
});

describe('statistical methodology page: worked examples say what the numbers say', () => {
    it('rates and the early example', () => {
        expect(m.control.conversion_rate).toBeCloseTo(0.05, 6);
        expect(m.variant.conversion_rate).toBeCloseTo(0.065, 6);
        expect((m.ex.early.controlConversions / m.ex.early.visitors)).toBeCloseTo(0.05, 6);
        expect((m.ex.early.variantConversions / m.ex.early.visitors)).toBeCloseTo(0.065, 6);
        expect(page.match(/5\.0% against 6\.5%/g)).toHaveLength(2);
    });

    it('verdict labels follow the computed p-values', () => {
        expect(m.seq.is_significant).toBe(true);
        expect(m.seqThree.is_significant).toBe(false);
        expect(m.early.seq.is_significant).toBe(false);
        expect(m.early.fixed.p_value).toBeLessThan(0.05);
        expect(m.early.chance).toBeGreaterThan(0.95);
        expect(m.srmBad.mismatch).toBe(true);
        expect(m.srmFine.mismatch).toBe(false);
        expect(m.revenueSmall).toBeGreaterThan(0.05);
        expect(m.revenueLarge).toBeLessThan(0.05);
        expect(m.liftCi.lower).toBeGreaterThan(0);
    });

    it('"about 2 to 3 times" holds for every case shown', () => {
        expect(m.cost).toHaveLength(COST_CASES.length);
        for (const c of m.cost) {
            expect(c.fixed).toBeGreaterThan(0);
            const ratio = c.sequential / c.fixed;
            expect(ratio, `${c.baseline} ${c.lift}`).toBeGreaterThanOrEqual(2);
            expect(ratio, `${c.baseline} ${c.lift}`).toBeLessThanOrEqual(3);
        }
    });

    it('sample size matches the docs table', () => {
        expect(m.sampleSize).toBe(8159);
        expect(getDocPage('results')!.blocks.map(blockText).join(' ')).toContain('8,159');
    });
});

describe('statistical methodology page: structure and links', () => {
    it('metadata, breadcrumb and a section for every summary row', () => {
        expect(page).toContain("path: '/statistical-methodology'");
        expect(page).toContain("{ href: '/statistical-methodology', label: 'Statistical methodology' }");
        for (const s of SUMMARY) expect(page, s.anchor).toContain(`id="${s.anchor}"`);
        for (const id of ['summary', 'fixed', 'auto-shift', 'reading', 'numerics']) expect(page).toContain(`id="${id}"`);
    });

    it('every link goes somewhere that exists', () => {
        expect([page, content].flatMap(hrefsIn).map(checkHref).filter(Boolean)).toEqual([]);
    });

    it('menu, footer, homepage, product pages, docs and sitemap point at it', () => {
        const items = NAV_MENUS.flatMap((g) => g.groups.flatMap((x) => x.items));
        expect(items.find((i) => i.title === 'Statistical methods')?.href).toBe('/statistical-methodology');
        expect(FOOTER_COLUMNS.flatMap((c) => c.links).some((l) => l.href === '/statistical-methodology')).toBe(true);
        for (const f of ['app/page.tsx', 'app/experiment-analytics/page.tsx', 'app/developers/page.tsx']) expect(read(f), f).toContain('href="/statistical-methodology"');
        expect(read('lib/site/home.ts')).toContain("href: '/statistical-methodology'");
        expect(blockText(getDocPage('results')!.blocks.find((b) => b.type === 'p' && b.text.includes('/statistical-methodology'))!)).toContain('Statistical methodology');
        expect(read('app/sitemap.ts')).toContain("'/statistical-methodology'");
    });

    it('copy stays honest and plain', () => {
        for (const src of [page, content]) {
            expect(src).not.toMatch(/—|Bayesian test|guarantee|unlimited|free trial/i);
            expect(src).not.toMatch(/seamless|effortless|unlock|supercharge|leverage|elevate|empower|cutting-edge|game-changer|revolutioni[sz]e|delve|robust|world-class|best-in-class|blazing/i);
            expect(src).not.toMatch(/z-tests? (decides?|picks) the winner/i);
        }
        expect(page).toContain('Example numbers.');
        expect((page.match(/<SampleDataFrame>/g) ?? []).length).toBeGreaterThanOrEqual(7);
    });
});
