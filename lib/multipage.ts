import { z } from 'zod';
import { urlsMatch } from './domains';
import { popupMatchesUrl } from './popups';
import type { Experiment, Variation } from './types';

/**
 * Multi-page tests (Growth+): a visual test can run on more pages than its control page, for example every product
 * page. The variations' visual changes apply on the control page and on every page that matches one of these rules,
 * so the same element changes across the whole set. Split URL tests keep one page per version.
 */
export const MAX_PAGES = 10;
export const PAGE_RULE_MATCH = ['equals', 'starts_with', 'contains'] as const;

export const pageRuleSchema = z.object({
    match: z.enum(PAGE_RULE_MATCH),
    value: z.string().trim().min(1, 'Add the page address or part of it').max(500),
}).strict();
export type PageRule = z.infer<typeof pageRuleSchema>;

export const pagesSchema = z.object({
    pages: z.array(pageRuleSchema).max(MAX_PAGES, `A test can have up to ${MAX_PAGES} extra page rules`),
}).strict();

/** Parses the stored JSON. Bad or missing data reads as no extra pages. */
export function parsePages(raw: string | null | undefined): PageRule[] {
    if (!raw) return [];
    try {
        const r = pagesSchema.shape.pages.safeParse(JSON.parse(raw));
        return r.success ? r.data : [];
    } catch {
        return [];
    }
}

export function serializePages(pages: PageRule[]): string | null {
    return pages.length ? JSON.stringify(pages) : null;
}

export function pageRuleMatches(rule: PageRule, url: string): boolean {
    return popupMatchesUrl({ match: rule.match, match_value: rule.value }, url);
}

/** True on one of the extra pages of a multi-page test (not the control page itself). */
export function onExtraPage(experiment: Pick<Experiment, 'pages'>, url: string): boolean {
    return parsePages(experiment.pages).some((r) => pageRuleMatches(r, url));
}

/** The control page or one of the extra pages: where visual changes apply. */
export function onTestPage(experiment: Pick<Experiment, 'control_url' | 'pages'>, controlUrl: string, url: string): boolean {
    return (!!controlUrl && urlsMatch(controlUrl, url)) || onExtraPage(experiment, url);
}

/** Extra pages need a visual test: every version runs on the visitor's own page. */
export function multiPageAllowed(variations: Pick<Variation, 'is_control' | 'url'>[]): boolean {
    return variations.some((v) => !v.is_control) && variations.every((v) => v.is_control || !v.url);
}

export function describePageRule(r: PageRule): string {
    return r.match === 'equals' ? `Page is ${r.value}` : r.match === 'starts_with' ? `Address starts with ${r.value}` : `Address contains ${r.value}`;
}
