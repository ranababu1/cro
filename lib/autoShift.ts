/**
 * Auto-shift traffic to the winner (Growth plan and above).
 * Thompson sampling on the primary goal: each active variation gets new visitors in proportion to the
 * chance it is the best one, with a floor so every version keeps collecting data. Visitors already in
 * the test keep their version; only new visitors follow the new split.
 */

/** Visitors every active variation needs before the split moves. */
export const AUTO_SHIFT_MIN_VISITORS = 100;
/** How often the split is recomputed while the test gets traffic. */
export const AUTO_SHIFT_INTERVAL_MS = 60 * 60 * 1000;
/** Largest guaranteed share per active variation, in percent. With many variations it is lower (see shiftFloor). */
export const AUTO_SHIFT_FLOOR = 10;
const DRAWS = 4000;

export interface ShiftArm { id: string; visitors: number; conversions: number }

/** Small seeded PRNG (mulberry32) so a rebalance is reproducible in tests. */
export function seededRandom(seed: number): () => number {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

export function hashSeed(s: string): number {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
    return h >>> 0;
}

function normal(rand: () => number): number {
    const u = Math.max(rand(), 1e-12);
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rand());
}

/** Gamma(shape, 1) sample, Marsaglia and Tsang. */
function gamma(shape: number, rand: () => number): number {
    if (shape < 1) return gamma(shape + 1, rand) * Math.pow(Math.max(rand(), 1e-12), 1 / shape);
    const d = shape - 1 / 3;
    const c = 1 / Math.sqrt(9 * d);
    for (;;) {
        let x: number, v: number;
        do { x = normal(rand); v = 1 + c * x; } while (v <= 0);
        v = v * v * v;
        const u = rand();
        if (u < 1 - 0.0331 * x * x * x * x || Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
    }
}

function beta(a: number, b: number, rand: () => number): number {
    const x = gamma(a, rand);
    return x / (x + gamma(b, rand));
}

/** Chance that each arm has the highest conversion rate, from Beta(1 + conversions, 1 + non-conversions) posteriors. */
export function probabilityBest(arms: ShiftArm[], rand: () => number, draws = DRAWS): number[] {
    const wins = arms.map(() => 0);
    for (let i = 0; i < draws; i++) {
        let best = -1;
        let bestVal = -1;
        arms.forEach((a, k) => {
            const conv = Math.min(Math.max(a.conversions, 0), Math.max(a.visitors, 0));
            const val = beta(1 + conv, 1 + Math.max(a.visitors, 0) - conv, rand);
            if (val > bestVal) { bestVal = val; best = k; }
        });
        wins[best]++;
    }
    return wins.map((w) => w / draws);
}

/** Guaranteed share per active variation, so the split always sums to 100 with room left to shift. */
export function shiftFloor(n: number): number {
    return Math.min(AUTO_SHIFT_FLOOR, Math.floor(50 / Math.max(n, 1)));
}

/** Whole-number weights that sum to 100: floor for everyone, the rest split by probability of being best. */
export function weightsFromProbabilities(probs: number[]): number[] {
    const n = probs.length;
    const floor = shiftFloor(n);
    const free = 100 - floor * n;
    const raw = probs.map((p) => floor + free * p);
    const out = raw.map(Math.floor);
    let left = 100 - out.reduce((a, b) => a + b, 0);
    const order = raw.map((r, i) => ({ i, frac: r - Math.floor(r) })).sort((a, b) => b.frac - a.frac);
    for (let k = 0; left > 0; k = (k + 1) % n, left--) out[order[k].i]++;
    return out;
}

export type ShiftPlan =
    | { ok: true; weights: Map<string, number>; probabilities: Map<string, number> }
    | { ok: false; reason: 'not_enough_data' | 'too_few_arms' };

/** New weights for the active (not paused) variations, or why the split stays as it is. */
export function planShift(arms: ShiftArm[], rand: () => number): ShiftPlan {
    if (arms.length < 2) return { ok: false, reason: 'too_few_arms' };
    if (arms.some((a) => a.visitors < AUTO_SHIFT_MIN_VISITORS)) return { ok: false, reason: 'not_enough_data' };
    const probs = probabilityBest(arms, rand);
    const w = weightsFromProbabilities(probs);
    return { ok: true, weights: new Map(arms.map((a, i) => [a.id, w[i]])), probabilities: new Map(arms.map((a, i) => [a.id, probs[i]])) };
}
