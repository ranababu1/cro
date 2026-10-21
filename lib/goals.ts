import { parse } from 'css-what';
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


/** Most goals one experiment can have. */
export const MAX_GOALS = 50;

/**
 * A goal targets exactly one CSS selector. Lists such as "a, button" are refused so each element
 * gets its own named goal with its own numbers.
 */
export function checkGoalSelector(selector: string): string | null {
    const sel = selector.trim();
    if (!sel || sel.length > 300) return 'Enter a CSS selector of up to 300 characters';
    if (sel.includes('<')) return 'Enter a CSS selector, not HTML';
    let groups;
    try { groups = parse(sel); } catch { return 'That is not a valid CSS selector'; }
    if (groups.length !== 1) return 'Use one CSS selector per goal. Add another goal for each extra element.';
    return null;
}

/** Goal types a plan without advanced goals (Free) may use: one click on a CSS selector. */
export const BASIC_GOAL_TYPES: readonly GoalType[] = ['click'];

/**
 * Plan rule for adding goals to a test. Free: at most FREE_MAX_GOALS goals per test, click goals only.
 * Returns the message to show, or null when allowed.
 */
export function goalPlanError(rule: { maxGoals: number | null; advancedGoals: boolean }, adding: { type?: string | null }[], existing = 0): string | null {
    if (!rule.advancedGoals && adding.some((g) => !BASIC_GOAL_TYPES.includes((g.type || 'click') as GoalType))) {
        return 'The free plan has one goal per test: a click on a CSS selector. Form submit, page visit and custom event goals need Starter or above.';
    }
    if (rule.maxGoals !== null && existing + adding.length > rule.maxGoals) {
        const allows = `Your plan allows ${rule.maxGoals} goal${rule.maxGoals === 1 ? '' : 's'} per test.`;
        return existing > 0
            ? `${allows} Remove a goal first, or upgrade to Starter or above for up to ${MAX_GOALS}.`
            : `${allows} Upgrade to Starter or above for up to ${MAX_GOALS}.`;
    }
    return null;
}
