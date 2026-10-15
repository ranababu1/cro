import { z } from 'zod';
import { EVENT_NAME_RE, isValidRegex, checkGoalSelector, MAX_GOALS } from './goals';
import { targetingSchema } from './targeting';

// Forms send empty strings for blank optional fields.
const blankToUndefined = (v: unknown) => (v === '' ? undefined : v);

const id = z.string().min(1).max(100);
// Visitor ids come from browsers. Keep them bounded and printable.
const visitorId = z.string().min(1).max(200).regex(/^[\x21-\x7e]+$/, 'user_id must be printable ASCII without spaces');

export const goalSchema = z
    .object({
        name: z.string().trim().min(1, 'Goal name is required').max(200),
        type: z.enum(['click', 'form', 'page', 'event']).default('click'),
        selector: z.string().trim().min(1).max(500),
        match_type: z.preprocess(blankToUndefined, z.enum(['equals', 'contains', 'regex']).optional()),
        is_primary: z.boolean(),
    })
    .superRefine((g, ctx) => {
        if (g.type === 'click' || g.type === 'form') {
            const problem = checkGoalSelector(g.selector);
            if (problem) ctx.addIssue({ code: 'custom', path: ['selector'], message: problem });
        } else if (g.type === 'page') {
            if (g.match_type === 'regex' && (!isValidRegex(g.selector) || g.selector.length > 300)) ctx.addIssue({ code: 'custom', path: ['selector'], message: 'URL pattern is not a valid regular expression' });
        } else if (!EVENT_NAME_RE.test(g.selector)) {
            ctx.addIssue({ code: 'custom', path: ['selector'], message: 'event name may use letters, numbers, _ . : - only' });
        }
    })
    .transform((g) => ({ ...g, match_type: g.type === 'page' ? (g.match_type ?? 'equals') : null }));

export const customEventSchema = z.object({
    user_id: visitorId,
    event_name: z.string().regex(EVENT_NAME_RE),
});

export const createDomainSchema = z.object({
    host: z.string().trim().min(1).max(253),
});

export const createExperimentSchema = z.object({
    name: z.string().trim().min(1).max(200),
    description: z.string().max(2000).optional(),
    project_id: id.optional(),
    control_url: z.string().url().max(2000),
    traffic_allocation: z.number().int().min(0).max(100).optional(),
    targeting: targetingSchema.optional(),
    variations: z
        .array(
            z.object({
                name: z.string().trim().min(1).max(200),
                description: z.preprocess(blankToUndefined, z.string().max(2000).optional()),
                url: z.string().url().max(2000),
                weight: z.number().min(0).max(100),
                is_control: z.boolean(),
            }),
        )
        .min(2, 'Experiment must have a control and at least one variation')
        .max(60), // soft cap; plan limit (control plus 50 on paid) enforced in the route via lib/entitlements.ts
    goals: z
        .array(goalSchema)
        .min(1, 'Add at least one goal')
        .max(MAX_GOALS, `A test can have up to ${MAX_GOALS} goals`)
        .refine((gs) => gs.filter((g) => g.is_primary).length <= 1, 'Only one goal can be primary'),
});

export const updateExperimentSchema = z
    .object({
        name: z.string().trim().min(1).max(200),
        description: z.string().max(2000),
        status: z.enum(['draft', 'running', 'paused', 'completed']),
        traffic_allocation: z.number().int().min(0).max(100),
        targeting: targetingSchema,
    })
    .partial()
    .strict();

export const allocationSchema = z.object({
    variations: z.array(z.object({ id, weight: z.number().int().min(0).max(100), paused: z.boolean().default(false) })).min(2).max(51),
});

export const assignSchema = z.object({
    experiment_id: id.optional(),
    url: z.string().url().max(2000).optional(),
    user_id: visitorId,
}).refine((v) => !!v.experiment_id || !!v.url, 'experiment_id or url is required');

export const bootstrapSchema = z.object({
    url: z.string().url().max(2000),
    user_id: visitorId,
    referrer: z.string().max(2000).optional(),
    visitor: z.enum(['new', 'returning']).optional(),
});

export const trackSchema = z.object({
    experiment_id: id,
    variation_id: id,
    user_id: visitorId,
    event_type: z.enum(['page_view', 'conversion']),
    event_name: z.string().max(200).optional(),
    goal_id: id.optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
});

/** Batched events from the SDK (sendBeacon). */
export const trackBatchSchema = z.object({ events: z.array(trackSchema).min(1).max(50) });

export const createApiKeySchema = z.object({
    environment_id: id,
    type: z.enum(['sdk', 'secret']),
    label: z.string().max(100).optional(),
});

/** Turns a Zod error into a short message for API responses. */
export function formatZodError(error: z.ZodError): string {
    return error.issues.map((i) => (i.path.length ? `${i.path.join('.')}: ${i.message}` : i.message)).join('; ');
}

const limit = z.number().int().min(0).max(1_000_000_000).nullable();

export const adminUpdateOrgSchema = z
    .object({
        status: z.enum(['active', 'suspended']),
        suspended_reason: z.string().trim().max(500).nullable(),
        plan: z.string().trim().min(1).max(50),
        monthly_visitor_limit: limit,
        monthly_experiment_limit: limit,
        // null = plan default, -1 = unlimited
        monthly_pageview_limit: z.number().int().min(-1).max(1_000_000_000).nullable(),
    })
    .partial()
    .strict()
    .refine((v) => Object.keys(v).length > 0, 'No changes');
