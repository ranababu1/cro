/**
 * Goal types. Every goal stores its target in `selector`:
 * - click: CSS selector of the element clicked
 * - form: CSS selector of the form submitted
 * - page: URL pattern the visitor reaches, compared with match_type
 * - event: custom event name sent with ABTest.track('name')
 */
export const GOAL_TYPES = ['click', 'form', 'page', 'event'] as const;
export type GoalType = (typeof GOAL_TYPES)[number];
export const PAGE_MATCH_TYPES = ['equals', 'contains', 'regex'] as const;
export type PageMatchType = (typeof PAGE_MATCH_TYPES)[number];

export const GOAL_TYPE_LABELS: Record<GoalType, string> = {
    click: 'Click',
    form: 'Form submit',
    page: 'Page visit',
    event: 'Custom event',
};

function stripUrl(u: string): string {
    try {
        const x = new URL(u);
        let p = x.pathname || '/';
        if (p.length > 1 && p.endsWith('/')) p = p.slice(0, -1);
        return `${x.host.toLowerCase()}${p}`;
    } catch {
        return u.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/[?#].*$/, '').replace(/(.)\/$/, '$1');
    }
}

/** True when the page URL satisfies a page-visit goal. Invalid regexes never match. */
export function matchesPageGoal(pageUrl: string, matchType: string | null | undefined, pattern: string): boolean {
    if (!pattern) return false;
    const mt = (matchType || 'equals') as PageMatchType;
    if (mt === 'regex') {
        if (pattern.length > 300) return false;
        try { return new RegExp(pattern, 'i').test(pageUrl); } catch { return false; }
    }
    if (mt === 'contains') return pageUrl.toLowerCase().includes(pattern.toLowerCase());
    return stripUrl(pageUrl) === stripUrl(pattern);
}

export function isValidRegex(pattern: string): boolean {
    try { new RegExp(pattern); return true; } catch { return false; }
}

export const EVENT_NAME_RE = /^[A-Za-z0-9_.:-]{1,100}$/;

/** Short human description of a goal target for tables. */
export function describeGoal(g: { type?: string | null; selector: string; match_type?: string | null }): string {
    const t = (g.type || 'click') as GoalType;
    if (t === 'page') return `URL ${g.match_type || 'equals'} ${g.selector}`;
    if (t === 'event') return `ABTest.track('${g.selector}')`;
    return g.selector;
}
