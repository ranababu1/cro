import { z } from 'zod';
import { MAX_CHANGES, MAX_CSS, parseChanges, type VisualChange } from './visualChanges';
import type { Variation, VariationMetrics } from './types';

/**
 * Multivariate tests (Growth+). Each factor is one change on the page (a headline, a button) with the original and
 * one or two alternative levels. The test runs every combination as its own variation, so the usual results,
 * sequential test and Bonferroni split across comparisons apply, and the factor view adds each level's effect
 * averaged over the other factors. Levels are built from the draft's visual variations.
 */
export const MIN_FACTORS = 2;
export const MAX_FACTORS = 3;
export const MAX_ALT_LEVELS = 2;
export const MAX_COMBINATIONS = 18;
export const ORIGINAL_LEVEL = 'Original';

export interface MvtLevel { name: string; changes: VisualChange[] }
export interface MvtFactor { name: string; levels: MvtLevel[] }
export interface MvtConfig { factors: MvtFactor[] }

const factorName = z.string().trim().min(1, 'Name each factor').max(60);

/** Request: factors built from existing visual variations of the draft. Level 0 (the original) is implicit. */
export const buildMvtSchema = z.object({
    factors: z.array(z.object({
        name: factorName,
        variation_ids: z.array(z.string().min(1).max(100)).min(1, 'Each factor needs at least one version').max(MAX_ALT_LEVELS, `A factor can have up to ${MAX_ALT_LEVELS} versions besides the original`),
    }).strict()).min(MIN_FACTORS, `A multivariate test needs at least ${MIN_FACTORS} factors`).max(MAX_FACTORS, `A multivariate test can have up to ${MAX_FACTORS} factors`),
}).strict().superRefine((b, ctx) => {
    const ids = b.factors.flatMap((f) => f.variation_ids);
    if (new Set(ids).size !== ids.length) ctx.addIssue({ code: 'custom', message: 'Each variation can be used in one factor only' });
    const names = b.factors.map((f) => f.name.toLowerCase());
    if (new Set(names).size !== names.length) ctx.addIssue({ code: 'custom', message: 'Give each factor its own name' });
    const combos = b.factors.reduce((n, f) => n * (f.variation_ids.length + 1), 1);
    if (combos > MAX_COMBINATIONS) ctx.addIssue({ code: 'custom', message: `That makes ${combos} combinations. Keep it at ${MAX_COMBINATIONS} or fewer` });
});

const storedSchema = z.object({
    factors: z.array(z.object({
        name: z.string(),
        levels: z.array(z.object({ name: z.string(), changes: z.array(z.unknown()) })).min(2),
    })).min(1),
});

/** Parses the stored JSON; changes are re-checked with the visual change rules. Bad data reads as null. */
export function parseMvt(raw: string | null | undefined): MvtConfig | null {
    if (!raw) return null;
    try {
        const r = storedSchema.safeParse(JSON.parse(raw));
        if (!r.success) return null;
        return { factors: r.data.factors.map((f) => ({ name: f.name, levels: f.levels.map((l) => ({ name: l.name, changes: parseChanges(JSON.stringify(l.changes)) })) })) };
    } catch {
        return null;
    }
}

export function parseCombo(raw: string | null | undefined): number[] | null {
    if (!raw) return null;
    try {
        const a = JSON.parse(raw);
        return Array.isArray(a) && a.every((n) => Number.isInteger(n) && n >= 0) ? a : null;
    } catch {
        return null;
    }
}

/** Every combination of level indexes, all originals first. */
export function combinations(levelCounts: number[]): number[][] {
    let out: number[][] = [[]];
    for (const n of levelCounts) out = out.flatMap((c) => Array.from({ length: n }, (_, i) => [...c, i]));
    return out;
}

/** Whole-number weights that add up to 100, the remainder going to the first ones. */
export function evenWeights(n: number): number[] {
    const base = Math.floor(100 / n);
    return Array.from({ length: n }, (_, i) => base + (i < 100 - base * n ? 1 : 0));
}

export function comboName(config: MvtConfig, combo: number[]): string {
    const parts = combo.flatMap((li, fi) => (li === 0 ? [] : [config.factors[fi].levels[li].name]));
    return parts.length ? parts.join(' + ') : 'Control';
}

/** The changes of every level in the combination. Page CSS blocks are joined into one. */
export function comboChanges(config: MvtConfig, combo: number[]): VisualChange[] | { error: string } {
    const all = combo.flatMap((li, fi) => config.factors[fi].levels[li].changes);
    const css = all.filter((c) => c.action === 'css').map((c) => (c as Extract<VisualChange, { action: 'css' }>).value);
    const rest = all.filter((c) => c.action !== 'css');
    const merged = css.length ? [...rest, { selector: 'page' as const, action: 'css' as const, value: css.join('\n') }] : rest;
    if (merged.length > MAX_CHANGES) return { error: `"${comboName(config, combo)}" would have ${merged.length} changes. A variation can have up to ${MAX_CHANGES}` };
    if (css.join('\n').length > MAX_CSS) return { error: `"${comboName(config, combo)}" would have more than ${MAX_CSS} characters of page CSS` };
    return merged;
}

export interface ComboVariation { name: string; weight: number; is_control: boolean; changes: VisualChange[]; combo: number[] }

/** The variations of a multivariate test: one per combination, equal weights, the all-original one as control. */
export function buildCombos(config: MvtConfig): ComboVariation[] | { error: string } {
    const combos = combinations(config.factors.map((f) => f.levels.length));
    const weights = evenWeights(combos.length);
    const out: ComboVariation[] = [];
    for (const [i, combo] of combos.entries()) {
        const changes = comboChanges(config, combo);
        if ('error' in changes) return changes;
        out.push({ name: comboName(config, combo), weight: weights[i], is_control: combo.every((l) => l === 0), changes, combo });
    }
    return out;
}

export interface LevelEffect {
    factor: string;
    level: string;
    is_original: boolean;
    visitors: number;
    conversions: number;
    conversion_rate: number;
    /** Relative lift of this level's rate over the factor's original level. Null for the original or without data. */
    lift: number | null;
}

/**
 * Main effects: for each factor level, visitors and conversions summed over every combination that uses it. With
 * an even split the other factors balance out, so the rates compare one change at a time. A guide, not a separate
 * significance test: the verdict comes from the combinations.
 */
export function factorEffects(config: MvtConfig, variations: Pick<Variation, 'id' | 'combo'>[], results: Pick<VariationMetrics, 'variation_id' | 'total_users' | 'conversions'>[]): LevelEffect[][] {
    const byId = new Map(results.map((r) => [r.variation_id, r]));
    return config.factors.map((f, fi) => {
        const rows = f.levels.map((l, li) => {
            let visitors = 0, conversions = 0;
            for (const v of variations) {
                const combo = parseCombo(v.combo);
                const r = byId.get(v.id);
                if (!combo || !r || combo[fi] !== li) continue;
                visitors += r.total_users;
                conversions += r.conversions;
            }
            return { factor: f.name, level: l.name, is_original: li === 0, visitors, conversions, conversion_rate: visitors ? conversions / visitors : 0, lift: null as number | null };
        });
        const base = rows[0];
        for (const r of rows.slice(1)) r.lift = base.visitors && r.visitors && base.conversion_rate > 0 ? (r.conversion_rate - base.conversion_rate) / base.conversion_rate : null;
        return rows;
    });
}

/** Builds the stored config from the request and the draft's variations. */
export function configFromVariations(body: z.infer<typeof buildMvtSchema>, variations: Variation[]): MvtConfig | { error: string } {
    const factors: MvtFactor[] = [];
    for (const f of body.factors) {
        const levels: MvtLevel[] = [{ name: ORIGINAL_LEVEL, changes: [] }];
        for (const vid of f.variation_ids) {
            const v = variations.find((x) => x.id === vid);
            if (!v) return { error: 'Variation not found' };
            if (v.is_control || v.url) return { error: `"${v.name}" is not a visual variation. Levels come from variations that change the control page` };
            const changes = parseChanges(v.changes);
            if (!changes.length) return { error: `"${v.name}" has no visual changes yet` };
            levels.push({ name: v.name, changes });
        }
        factors.push({ name: f.name.trim(), levels });
    }
    return { factors };
}
