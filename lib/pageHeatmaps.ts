import { z } from 'zod';
import { heatmapCollection, heatmapRate, type HeatmapCollection } from './heatmapRules';
import { isSampled } from './heatmaps';
import { popupMatchesUrl } from './popups';
import type * as s from './db/schema';

/**
 * Page heatmaps (paid): clicks and scroll depth on pages without a test. A page rule picks the pages, and the sample
 * and stop rules work like a test's heatmap. The SDK loads heatmap.js only for sampled visitors on matching pages.
 */
export const MAX_PAGE_HEATMAPS = 10;
export const PAGE_HEATMAP_ID_PREFIX = 'phm_';
/** The one "version" of a page heatmap, stored in variation_id. */
export const PAGE_VARIATION = 'page';
export const PAGE_MATCH = ['equals', 'starts_with', 'contains'] as const;

export type PageHeatmapRow = typeof s.pageHeatmaps.$inferSelect;

const previewUrl = z.string().trim().max(2000).refine((u) => /^https?:\/\/[^\s/\\]+/i.test(u), 'Use a full address starting with http:// or https://');

export const createPageHeatmapSchema = z.object({
    name: z.string().trim().min(1, 'Add a name').max(120),
    match: z.enum(PAGE_MATCH).default('equals'),
    match_value: z.string().trim().min(1, 'Add the page address or part of it').max(500),
    preview_url: previewUrl.nullable().optional(),
}).strict();

export const updatePageHeatmapSchema = z.object({
    name: z.string().trim().min(1).max(120),
    status: z.enum(['active', 'paused']),
    match: z.enum(PAGE_MATCH),
    match_value: z.string().trim().min(1, 'Add the page address or part of it').max(500),
    preview_url: previewUrl.nullable(),
}).partial().strict();

export function isPageHeatmapId(id: string): boolean {
    return id.startsWith(PAGE_HEATMAP_ID_PREFIX);
}

/** A page heatmap's fields in the shape the shared sample and stop rules read. Days count from creation or the last new period. */
function ruleFields(h: PageHeatmapRow) {
    return { ...h, started_at: null };
}

export function pageCollection(h: PageHeatmapRow, now = new Date()): HeatmapCollection {
    return heatmapCollection(ruleFields(h), now);
}

export function pageMatches(h: Pick<PageHeatmapRow, 'match' | 'match_value'>, url: string): boolean {
    return popupMatchesUrl({ match: h.match, match_value: h.match_value }, url);
}

/** Address for the overlay view: the preview address, or the rule itself when it is a full address. */
export function pagePreviewUrl(h: Pick<PageHeatmapRow, 'match' | 'match_value' | 'preview_url'>): string | null {
    if (h.preview_url) return h.preview_url;
    return h.match !== 'contains' && /^https?:\/\//i.test(h.match_value) ? h.match_value : null;
}

/**
 * The page heatmap this visitor records on this page, if any: the first active one whose rule matches, that is still
 * collecting, and whose sample includes the visitor (decided per visitor and heatmap, so it does not flip).
 */
export function pickPageHeatmap(list: PageHeatmapRow[], url: string, userId: string, now = new Date()): PageHeatmapRow | null {
    for (const h of list) {
        if (h.status !== 'active' || !pageMatches(h, url)) continue;
        const rate = heatmapRate(ruleFields(h), now);
        if (rate > 0 && isSampled(userId, h.id, rate)) return h;
    }
    return null;
}

const MATCH_TEXT: Record<(typeof PAGE_MATCH)[number], string> = { equals: 'Page address is', starts_with: 'Page address starts with', contains: 'Page address contains' };

export function pageRuleText(h: Pick<PageHeatmapRow, 'match' | 'match_value'>): string {
    return `${MATCH_TEXT[h.match]} ${h.match_value}`;
}

export function pageHeatmapJson(h: PageHeatmapRow) {
    return {
        id: h.id, name: h.name, status: h.status, match: h.match, match_value: h.match_value, preview_url: h.preview_url,
        rule: pageRuleText(h), collection: pageCollection(h), created_at: h.created_at, updated_at: h.updated_at,
    };
}
