import { z } from 'zod';

/**
 * Visual editor: a variation without its own URL runs on the control page, and the SDK applies a short list of
 * changes to that page before it is shown. Changes are data, never code: text, hiding, a few style properties and
 * safe attributes, moving an element next to another one, and one block of page CSS. No HTML and no scripts, so a
 * change list cannot inject markup into a site. Page CSS cannot load anything (no url(), @import or escapes).
 */
export const MAX_CHANGES = 50;
export const VISUAL_ACTIONS = ['text', 'hide', 'style', 'attr', 'move', 'css'] as const;
export const MOVE_POSITIONS = ['before', 'after'] as const;
export const MAX_CSS = 10_000;
/** Page CSS may not fetch anything or break out of its style element. */
export const UNSAFE_CSS = /url\s*\(|@import|expression\s*\(|javascript:|behavior\s*:|-moz-binding|image-set\s*\(|[<\\]/i;
export const VISUAL_STYLES = ['color', 'background-color', 'font-size', 'font-weight', 'text-align', 'border-radius', 'padding', 'margin'] as const;
export const VISUAL_ATTRS = ['href', 'src', 'alt', 'placeholder', 'title'] as const;

const SAFE_URL = /^(https?:\/\/|\/(?!\/)|#|mailto:|tel:)/i;
const STYLE_VALUE = /^[#a-zA-Z0-9.,%()\s-]{1,100}$/;

export const visualChangeSchema = z.discriminatedUnion('action', [
    z.object({ selector: z.string().trim().min(1).max(500), action: z.literal('text'), value: z.string().max(5000) }),
    z.object({ selector: z.string().trim().min(1).max(500), action: z.literal('hide') }),
    z.object({ selector: z.string().trim().min(1).max(500), action: z.literal('style'), name: z.enum(VISUAL_STYLES), value: z.string().trim().regex(STYLE_VALUE, 'Use a plain CSS value, for example #0f766e or 18px') }),
    z.object({ selector: z.string().trim().min(1).max(500), action: z.literal('attr'), name: z.enum(VISUAL_ATTRS), value: z.string().trim().max(2000) }),
    z.object({ selector: z.string().trim().min(1).max(500), action: z.literal('move'), target: z.string().trim().min(1).max(500), position: z.enum(MOVE_POSITIONS) }),
    z.object({ selector: z.literal('page'), action: z.literal('css'), value: z.string().max(MAX_CSS, `Page CSS can be up to ${MAX_CSS} characters`) }),
]).superRefine((c, ctx) => {
    if (c.action === 'css' && UNSAFE_CSS.test(c.value)) {
        ctx.addIssue({ code: 'custom', message: 'Page CSS cannot use url(), @import, expression(), backslash escapes or < characters' });
    }
    if (c.action === 'move' && c.selector === c.target) ctx.addIssue({ code: 'custom', message: 'An element cannot be moved next to itself' });
    if (c.action === 'attr' && (c.name === 'href' || c.name === 'src') && !SAFE_URL.test(c.value)) {
        ctx.addIssue({ code: 'custom', message: 'Links and images need an http(s), relative, #, mailto: or tel: address' });
    }
});
export type VisualChange = z.infer<typeof visualChangeSchema>;

export const visualChangesSchema = z.object({
    changes: z.array(visualChangeSchema).max(MAX_CHANGES, `A variation can have up to ${MAX_CHANGES} visual changes`)
        .refine((l) => l.filter((c) => c.action === 'css').length <= 1, 'A variation can have one block of page CSS'),
});

/** Parses the stored JSON. Bad or missing data reads as no changes, so a broken row never breaks a page. */
export function parseChanges(raw: string | null | undefined): VisualChange[] {
    if (!raw) return [];
    try {
        const r = visualChangesSchema.safeParse({ changes: JSON.parse(raw) });
        return r.success ? r.data.changes : [];
    } catch {
        return [];
    }
}

export function serializeChanges(changes: VisualChange[]): string | null {
    return changes.length ? JSON.stringify(changes) : null;
}

/** One-line summary for lists in the dashboard. */
export function describeChange(c: VisualChange): string {
    if (c.action === 'text') return `Text: "${c.value.length > 60 ? c.value.slice(0, 57) + '...' : c.value}"`;
    if (c.action === 'hide') return 'Hidden';
    if (c.action === 'move') return `Moved ${c.position} ${c.target}`;
    if (c.action === 'css') return `Page CSS (${c.value.length} characters)`;
    return `${c.name}: ${c.value}`;
}
