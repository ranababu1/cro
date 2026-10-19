import { z } from 'zod';
import { heatmapSampleRate } from './heatmaps';
import type { Experiment } from './types';

/**
 * Per-test heatmap collection: sample rate and stop rules.
 * Page views are counted when the capture module sends its final batch for a page (one scroll entry per page view).
 * The counter and the day rule run from heatmap_since, or from the test start when it is not set.
 */
export const HEATMAP_STOP_DAYS_MAX = 365;
export const HEATMAP_STOP_VIEWS_MIN = 100;
export const HEATMAP_STOP_VIEWS_MAX = 1_000_000;

export const heatmapSettingsSchema = z.object({
    sample_percent: z.number().int().min(1).max(100).nullable().optional(),
    stop_days: z.number().int().min(1).max(HEATMAP_STOP_DAYS_MAX).nullable().optional(),
    stop_views: z.number().int().min(HEATMAP_STOP_VIEWS_MIN).max(HEATMAP_STOP_VIEWS_MAX).nullable().optional(),
    /** Start a new collection period: resets the page view counter and the day rule. Existing data is kept. */
    restart: z.literal(true).optional(),
}).strict();
export type HeatmapSettingsInput = z.infer<typeof heatmapSettingsSchema>;

type RuleFields = Pick<Experiment, 'heatmap_sample' | 'heatmap_stop_days' | 'heatmap_stop_views' | 'heatmap_views' | 'heatmap_since' | 'started_at' | 'created_at'>;

export interface HeatmapCollection {
    sample_percent: number;
    custom_sample: boolean;
    default_percent: number;
    stop_days: number | null;
    stop_views: number | null;
    views: number;
    since: string;
    ends_at: string | null;
    collecting: boolean;
    stopped_by: 'days' | 'views' | null;
}

export function heatmapCollection(e: RuleFields, now = new Date()): HeatmapCollection {
    const sample = e.heatmap_sample != null && e.heatmap_sample >= 1 && e.heatmap_sample <= 100 ? e.heatmap_sample : null;
    const since = e.heatmap_since ?? e.started_at ?? e.created_at;
    const endsAt = e.heatmap_stop_days ? new Date(Date.parse(since) + e.heatmap_stop_days * 86_400_000) : null;
    const views = Number(e.heatmap_views ?? 0);
    const byViews = !!e.heatmap_stop_views && views >= e.heatmap_stop_views;
    const byDays = !!endsAt && now.getTime() >= endsAt.getTime();
    return {
        sample_percent: sample ?? Math.round(heatmapSampleRate() * 100),
        custom_sample: sample != null,
        default_percent: Math.round(heatmapSampleRate() * 100),
        stop_days: e.heatmap_stop_days ?? null,
        stop_views: e.heatmap_stop_views ?? null,
        views,
        since,
        ends_at: endsAt ? endsAt.toISOString() : null,
        collecting: !byViews && !byDays,
        stopped_by: byViews ? 'views' : byDays ? 'days' : null,
    };
}

/** Sample rate (0 to 1) for the bootstrap: 0 once a stop rule is reached. */
export function heatmapRate(e: RuleFields, now = new Date()): number {
    const c = heatmapCollection(e, now);
    return c.collecting ? c.sample_percent / 100 : 0;
}
