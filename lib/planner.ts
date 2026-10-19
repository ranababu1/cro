import { z } from 'zod';
import { estimateRequiredSampleSize } from './statistics';
import type * as s from './db/schema';

/**
 * Test planner (all plans): ideas with a hypothesis and a duration estimate. Plain rows, written only when someone
 * edits an idea, so there are no heavy writes.
 */
export const MAX_IDEAS = 200;
export const IDEA_STATUSES = ['idea', 'planned', 'started', 'dropped'] as const;
export const IDEA_PRIORITIES = ['low', 'medium', 'high'] as const;
export type IdeaRow = typeof s.testIdeas.$inferSelect;

/** The sequential test needs about 2 to 3 times the fixed-sample visitors to call the same lift (docs/results#sample-size). */
export const SEQUENTIAL_FACTOR = [2, 3] as const;

const pageUrl = z.string().trim().max(2000).refine((u) => /^https?:\/\/[^\s/\\]+/i.test(u), 'Use a full address starting with http:// or https://');
const fields = {
    title: z.string().trim().min(1, 'Add a title').max(120),
    hypothesis: z.string().trim().max(2000),
    page_url: pageUrl.nullable(),
    baseline_rate: z.number().gt(0, 'The conversion rate must be above 0%').lt(100, 'The conversion rate must be below 100%').nullable(),
    expected_lift: z.number().gt(0, 'The lift must be above 0%').max(1000).nullable(),
    daily_visitors: z.number().int().min(1).max(100_000_000).nullable(),
    variations: z.number().int().min(2).max(51),
    priority: z.enum(IDEA_PRIORITIES),
};
export const createIdeaSchema = z.object({
    ...fields,
    hypothesis: fields.hypothesis.default(''),
    page_url: fields.page_url.optional(),
    baseline_rate: fields.baseline_rate.optional(),
    expected_lift: fields.expected_lift.optional(),
    daily_visitors: fields.daily_visitors.optional(),
    variations: fields.variations.default(2),
    priority: fields.priority.default('medium'),
}).strict();
export const updateIdeaSchema = z.object({
    ...fields,
    status: z.enum(IDEA_STATUSES),
    /** Set when a test is created from the idea; the server checks the test is in the same project. */
    experiment_id: z.string().min(1).max(64).nullable(),
}).partial().strict();

export interface PlanEstimate {
    /** Visitors needed in each version (control included), fixed-sample, 95% confidence and 80% power. */
    per_variation: number;
    total: number;
    /** Days at the given daily visitors, or null without traffic. */
    fixed_days: number | null;
    /** Days for the peeking-safe test to call the same lift: about 2 to 3 times as long. */
    sequential_days: [number, number] | null;
    /** Significance level used per comparison (0.05 split across the comparisons with the control). */
    alpha: number;
}

/**
 * Duration estimate from the sample size formula used in the docs. With more than one variation, 0.05 is split
 * across the comparisons with the control, as the results do. Null when the rate or the lift is missing.
 */
export function planEstimate(i: { baseline_rate: number | null; expected_lift: number | null; daily_visitors: number | null; variations: number }): PlanEstimate | null {
    if (!i.baseline_rate || !i.expected_lift || i.baseline_rate <= 0 || i.baseline_rate >= 100 || i.expected_lift <= 0) return null;
    const p = i.baseline_rate / 100;
    const lift = i.expected_lift / 100;
    if (p * (1 + lift) >= 1) return null;
    const versions = Math.max(2, Math.round(i.variations));
    const alpha = 0.05 / (versions - 1);
    const perVariation = estimateRequiredSampleSize(p, lift, alpha, 0.8);
    const total = perVariation * versions;
    const days = i.daily_visitors && i.daily_visitors > 0 ? Math.ceil(total / i.daily_visitors) : null;
    return {
        per_variation: perVariation,
        total,
        fixed_days: days,
        sequential_days: days === null ? null : [days * SEQUENTIAL_FACTOR[0], days * SEQUENTIAL_FACTOR[1]],
        alpha,
    };
}

export function ideaJson(r: IdeaRow) {
    return {
        id: r.id, title: r.title, hypothesis: r.hypothesis, page_url: r.page_url, baseline_rate: r.baseline_rate, expected_lift: r.expected_lift,
        daily_visitors: r.daily_visitors, variations: r.variations, priority: r.priority, status: r.status, experiment_id: r.experiment_id,
        estimate: planEstimate(r), created_at: r.created_at, updated_at: r.updated_at,
    };
}
export type IdeaJson = ReturnType<typeof ideaJson>;

const num = (n: number) => n.toLocaleString('en-US');

/** One line, such as "About 31,235 visitors per version: 22 days, or 44 to 66 days with peeking-safe checks." */
export function estimateText(e: PlanEstimate | null): string {
    if (!e) return 'Add the conversion rate and the lift to get an estimate.';
    const base = `About ${num(e.per_variation)} visitors per version (${num(e.total)} in total)`;
    if (e.fixed_days === null) return `${base}. Add daily visitors to get a duration.`;
    const d = (n: number) => `${num(n)} day${n === 1 ? '' : 's'}`;
    return `${base}: ${d(e.fixed_days)} if you look once at the end, or about ${num(e.sequential_days![0])} to ${d(e.sequential_days![1])} to call it with the peeking-safe test.`;
}

