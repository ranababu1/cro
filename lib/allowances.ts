import { z } from 'zod';

/**
 * Custom allowances for special friend orgs. Each field overrides the plan when set.
 * Numbers: a positive cap, or null for unlimited. Omit a field to keep the plan default.
 * `flags` leaves room for future feature flags (name -> on/off).
 */
const cap = z.number().int().min(0).max(1_000_000_000).nullable().optional();

export const allowancesSchema = z.object({
    monthly_visitors: cap,
    daily_visitors: cap,
    lifetime_experiments: cap,
    monthly_pageviews: cap,
    heatmaps: z.boolean().optional(),
    recordings: z.boolean().optional(),
    wordpress_plugin: z.boolean().optional(),
    funnels: z.boolean().optional(),
    revenue_goals: z.boolean().optional(),
    auto_shift: z.boolean().optional(),
    max_variations: z.number().int().min(1).max(100).nullable().optional(),
    active_experiments: cap,
    projects: cap,
    seats: cap,
    domains: cap,
    flags: z.record(z.string().regex(/^[a-z][a-z0-9_]{0,40}$/), z.boolean()).optional(),
}).strict();

export type Allowances = z.infer<typeof allowancesSchema>;

export const adminSpecialFriendSchema = z.object({
    special_friend: z.boolean(),
    allowances: allowancesSchema,
}).strict();

/** Parses stored JSON; anything invalid is treated as no overrides. */
export function parseAllowances(raw: string | null | undefined): Allowances {
    if (!raw) return {};
    try {
        const r = allowancesSchema.safeParse(JSON.parse(raw));
        return r.success ? r.data : {};
    } catch {
        return {};
    }
}
