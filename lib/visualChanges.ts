import { z } from 'zod';

/**
 * Visual editor: a variation without its own URL runs on the control page, and the SDK applies a short list of
 * changes to that page before it is shown. Changes are data, never code: text, hiding, a few style properties and
 * safe attributes. No HTML and no scripts, so a change list cannot inject markup into a site.
 */
export const MAX_CHANGES = 50;
export const VISUAL_ACTIONS = ['text', 'hide', 'style', 'attr'] as const;
export const VISUAL_STYLES = ['color', 'background-color', 'font-size', 'font-weight', 'text-align', 'border-radius', 'padding', 'margin'] as const;
export const VISUAL_ATTRS = ['href', 'src', 'alt', 'placeholder', 'title'] as const;

const SAFE_URL = /^(https?:\/\/|\/(?!\/)|#|mailto:|tel:)/i;
const STYLE_VALUE = /^[#a-zA-Z0-9.,%()\s-]{1,100}$/;

export const visualChangeSchema = z.discriminatedUnion('action', [
    z.object({ selector: z.string().trim().min(1).max(500), action: z.literal('text'), value: z.string().max(5000) }),
    z.object({ selector: z.string().trim().min(1).max(500), action: z.literal('hide') }),
    z.object({ selector: z.string().trim().min(1).max(500), action: z.literal('style'), name: z.enum(VISUAL_STYLES), value: z.string().trim().regex(STYLE_VALUE, 'Use a plain CSS value, for example #0f766e or 18px') }),
    z.object({ selector: z.string().trim().min(1).max(500), action: z.literal('attr'), name: z.enum(VISUAL_ATTRS), value: z.string().trim().max(2000) }),
]).superRefine((c, ctx) => {
    if (c.action === 'attr' && (c.name === 'href' || c.name === 'src') && !SAFE_URL.test(c.value)) {
        ctx.addIssue({ code: 'custom', message: 'Links and images need an http(s), relative, #, mailto: or tel: address' });
    }
});
export type VisualChange = z.infer<typeof visualChangeSchema>;

export const visualChangesSchema = z.object({
    changes: z.array(visualChangeSchema).max(MAX_CHANGES, `A variation can have up to ${MAX_CHANGES} visual changes`),
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
    return `${c.name}: ${c.value}`;
}
