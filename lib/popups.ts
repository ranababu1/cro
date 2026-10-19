import { z } from 'zod';

/**
 * Popups and calls to action (paid). A popup is plain content (title, text, one button) with a trigger, a place on
 * the page, a page rule and a frequency. The SDK only loads popups.js on pages where an active popup matches.
 */
export const MAX_POPUPS_PER_PROJECT = 20;
export const POPUP_POSITIONS = ['center', 'bottom-right', 'bottom-left', 'top-bar', 'bottom-bar'] as const;
export const POPUP_TRIGGERS = ['delay', 'scroll', 'exit'] as const;
export const POPUP_FREQUENCIES = ['once', 'session', 'every_page'] as const;
export const POPUP_DEVICES = ['all', 'desktop', 'mobile'] as const;
export const POPUP_MATCH = ['all', 'equals', 'contains', 'starts_with'] as const;
export const POPUP_METRICS = ['view', 'click', 'close'] as const;
export const POPUP_STATUSES = ['draft', 'active', 'paused'] as const;

const SAFE_URL = /^(https?:\/\/|\/(?!\/)|#|mailto:|tel:)/i;
const COLOR = /^#[0-9a-fA-F]{6}$/;

export const popupConfigSchema = z.object({
    title: z.string().trim().min(1, 'Add a title').max(120),
    body: z.string().trim().max(600).default(''),
    button_text: z.string().trim().min(1, 'Add the button text').max(40),
    button_url: z.string().trim().max(2000).refine((u) => SAFE_URL.test(u), 'The button needs an http(s), relative, #, mailto: or tel: address'),
    new_tab: z.boolean().default(false),
    position: z.enum(POPUP_POSITIONS).default('center'),
    color: z.string().regex(COLOR, 'Use a hex color such as #2563eb').default('#2563eb'),
    trigger: z.enum(POPUP_TRIGGERS).default('delay'),
    /** Seconds for delay, percent of the page for scroll. Ignored for exit intent. */
    trigger_value: z.number().int().min(0).max(600).default(5),
    frequency: z.enum(POPUP_FREQUENCIES).default('once'),
    device: z.enum(POPUP_DEVICES).default('all'),
    match: z.enum(POPUP_MATCH).default('all'),
    match_value: z.string().trim().max(500).default(''),
}).superRefine((c, ctx) => {
    if (c.trigger === 'scroll' && c.trigger_value > 100) ctx.addIssue({ code: 'custom', path: ['trigger_value'], message: 'Scroll depth is a percent from 0 to 100' });
    if (c.match !== 'all' && !c.match_value) ctx.addIssue({ code: 'custom', path: ['match_value'], message: 'Add the page address or part of it' });
});
export type PopupConfig = z.infer<typeof popupConfigSchema>;

export const createPopupSchema = z.object({
    name: z.string().trim().min(1).max(120),
    status: z.enum(POPUP_STATUSES).default('draft'),
    config: popupConfigSchema,
});
export const updatePopupSchema = z.object({
    name: z.string().trim().min(1).max(120),
    status: z.enum(POPUP_STATUSES),
    config: popupConfigSchema,
}).partial().strict();

export const popupEventSchema = z.object({
    popup_id: z.string().min(1).max(64),
    event: z.enum(POPUP_METRICS),
});

export function parsePopupConfig(raw: string): PopupConfig | null {
    try {
        const r = popupConfigSchema.safeParse(JSON.parse(raw));
        return r.success ? r.data : null;
    } catch {
        return null;
    }
}

function normUrl(u: string): { host: string; path: string } {
    try {
        const x = new URL(u);
        return { host: x.host.toLowerCase().replace(/^www\./, ''), path: x.pathname.replace(/\/+$/, '') || '/' };
    } catch {
        return { host: '', path: u.split(/[?#]/)[0].replace(/\/+$/, '') || '/' };
    }
}

/** Does the page rule match this address? Query strings are ignored; a rule without a host compares paths only. */
export function popupMatchesUrl(c: Pick<PopupConfig, 'match' | 'match_value'>, url: string): boolean {
    if (c.match === 'all') return true;
    const page = normUrl(url);
    if (c.match === 'contains') return (page.host + page.path).includes(c.match_value.trim());
    const want = normUrl(c.match_value.trim());
    const p = want.host ? page.host + page.path : page.path;
    const w = want.host ? want.host + want.path : want.path;
    return c.match === 'equals' ? p === w : p.startsWith(w);
}

/** The part of a popup the browser needs. */
export function sdkPopup(id: string, c: PopupConfig) {
    return { id, title: c.title, body: c.body, button_text: c.button_text, button_url: c.button_url, new_tab: c.new_tab, position: c.position, color: c.color, trigger: c.trigger, trigger_value: c.trigger_value, frequency: c.frequency, device: c.device };
}
export type SdkPopup = ReturnType<typeof sdkPopup>;

export interface PopupStats { views: number; clicks: number; closes: number; ctr: number | null }

export function popupStats(rows: Array<{ popup_id: string; metric: string; count: number }>): Map<string, PopupStats> {
    const out = new Map<string, PopupStats>();
    for (const r of rows) {
        const s = out.get(r.popup_id) ?? { views: 0, clicks: 0, closes: 0, ctr: null };
        if (r.metric === 'view') s.views += r.count;
        if (r.metric === 'click') s.clicks += r.count;
        if (r.metric === 'close') s.closes += r.count;
        out.set(r.popup_id, s);
    }
    for (const s of out.values()) s.ctr = s.views ? s.clicks / s.views : null;
    return out;
}
