import { z } from 'zod';

// Forms send empty strings for blank optional fields.
const blankToUndefined = (v: unknown) => (v === '' ? undefined : v);

const id = z.string().min(1).max(100);
// Visitor ids come from browsers. Keep them bounded and printable.
const visitorId = z.string().min(1).max(200).regex(/^[\x21-\x7e]+$/, 'user_id must be printable ASCII without spaces');

const cssSelector = z
    .string()
    .trim()
    .min(1)
    .max(300)
    .refine((s) => !/[<>]/.test(s), 'selector must be a CSS selector');

export const createDomainSchema = z.object({
    host: z.string().trim().min(1).max(253),
});

export const createExperimentSchema = z.object({
    name: z.string().trim().min(1).max(200),
    description: z.string().max(2000).optional(),
    project_id: id.optional(),
    control_url: z.string().url().max(2000),
    traffic_allocation: z.number().int().min(0).max(100).optional(),
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
        .max(20), // soft cap; plan limit enforced in the route
    goals: z
        .array(
            z.object({
                name: z.string().trim().min(1).max(200),
                selector: cssSelector,
                is_primary: z.boolean(),
            }),
        )
        .min(1, 'Add at least one click goal')
        .max(20),
});

export const updateExperimentSchema = z
    .object({
        name: z.string().trim().min(1).max(200),
        description: z.string().max(2000),
        status: z.enum(['draft', 'running', 'paused', 'completed']),
        traffic_allocation: z.number().int().min(0).max(100),
    })
    .partial()
    .strict();

export const assignSchema = z.object({
    experiment_id: id.optional(),
    url: z.string().url().max(2000).optional(),
    user_id: visitorId,
}).refine((v) => !!v.experiment_id || !!v.url, 'experiment_id or url is required');

export const bootstrapSchema = z.object({
    url: z.string().url().max(2000),
    user_id: visitorId,
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
    })
    .partial()
    .strict()
    .refine((v) => Object.keys(v).length > 0, 'No changes');
