import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { Window } from 'happy-dom';
import { visualChangesSchema, visualChangeSchema, describeChange, parseChanges, UNSAFE_CSS } from '@/lib/visualChanges';

const visual = fs.readFileSync(path.join(__dirname, '../public/visual.js'), 'utf8');
function page(html: string, cfg: Record<string, unknown>) {
    const w = new Window({ url: 'https://www.example.com/pricing' });
    w.document.body.innerHTML = html;
    (w as unknown as Record<string, unknown>).__ABTestVisual = cfg;
    w.eval(visual);
    return w;
}
const order = (w: Window) => [...w.document.querySelectorAll('ul > li')].map((li) => li.textContent).join(',');

describe('move and page CSS change types', () => {
    it('validates moves and page CSS', () => {
        expect(visualChangeSchema.safeParse({ selector: '#a', action: 'move', target: '#b', position: 'before' }).success).toBe(true);
        expect(visualChangeSchema.safeParse({ selector: '#a', action: 'move', target: '#b', position: 'inside' }).success).toBe(false);
        expect(visualChangeSchema.safeParse({ selector: '#a', action: 'move', target: '#a', position: 'after' }).success).toBe(false);
        expect(visualChangeSchema.safeParse({ selector: 'page', action: 'css', value: '.hero h1 { color: #0f766e; }' }).success).toBe(true);
        expect(visualChangeSchema.safeParse({ selector: 'body', action: 'css', value: 'a{}' }).success).toBe(false);
        for (const bad of ['a{background:url(https://x.test/a)}', 'a{background:URL (x)}', '@import "x.css";', 'a{x:expression(alert(1))}', '</style><script>', 'a{content:"\\75rl("}', 'a{background-image:image-set("x.png" 1x)}', 'a{-moz-binding:x}']) {
            expect(UNSAFE_CSS.test(bad)).toBe(true);
            expect(visualChangeSchema.safeParse({ selector: 'page', action: 'css', value: bad }).success).toBe(false);
        }
        expect(visualChangeSchema.safeParse({ selector: 'page', action: 'css', value: 'x'.repeat(10_001) }).success).toBe(false);
        const two = [{ selector: 'page', action: 'css', value: 'a{}' }, { selector: 'page', action: 'css', value: 'b{}' }];
        expect(visualChangesSchema.safeParse({ changes: two }).success).toBe(false);
        expect(describeChange({ selector: '#a', action: 'move', target: '#b', position: 'after' })).toBe('Moved after #b');
        expect(describeChange({ selector: 'page', action: 'css', value: 'a{}' })).toBe('Page CSS (3 characters)');
        expect(parseChanges(JSON.stringify([{ selector: 'page', action: 'css', value: '@import "x"' }]))).toEqual([]);
    });
});

describe('visual.js moves and page CSS', () => {
    it('moves an element before or after another, once', () => {
        const w = page('<ul><li id="a">A</li><li id="b">B</li><li id="c">C</li></ul>', {
            changes: [{ selector: '#c', action: 'move', target: '#a', position: 'before' }, { selector: '#a', action: 'move', target: '#b', position: 'after' }],
        });
        expect(order(w)).toBe('C,B,A');
        // Re-applying does nothing more.
        (w as unknown as { ABTestVisual: { apply: (l: unknown[]) => number } }).ABTestVisual.apply([]);
        expect(order(w)).toBe('C,B,A');
    });

    it('ignores moves into the element itself, missing targets and bad positions', () => {
        const w = page('<ul><li id="a">A<span id="in">x</span></li><li id="b">B</li></ul>', {
            changes: [
                { selector: '#a', action: 'move', target: '#in', position: 'before' },
                { selector: '#a', action: 'move', target: '#nope', position: 'after' },
                { selector: '#b', action: 'move', target: '#a', position: 'inside' },
            ],
        });
        expect(order(w)).toBe('Ax,B');
    });

    it('keeps applying text changes to the same element after a move changes nth-of-type', () => {
        const w = page('<ul><li>A</li><li>B</li></ul>', {
            changes: [
                { selector: 'ul > li:nth-of-type(2)', action: 'text', value: 'New B' },
                { selector: 'ul > li:nth-of-type(2)', action: 'move', target: 'ul > li:nth-of-type(1)', position: 'before' },
            ],
        });
        expect(order(w)).toBe('New B,A');
        (w as unknown as { ABTestVisual: { apply: (l: unknown[]) => number } }).ABTestVisual.apply([]);
        expect(order(w)).toBe('New B,A');
    });

    it('adds page CSS as text in one style element and refuses unsafe CSS', () => {
        const w = page('<h1>Hi</h1>', { changes: [{ selector: 'page', action: 'css', value: 'h1 { color: rgb(1, 2, 3); }' }] });
        const styles = w.document.querySelectorAll('style[data-fabt-css]');
        expect(styles.length).toBe(1);
        expect(styles[0].textContent).toBe('h1 { color: rgb(1, 2, 3); }');
        expect(styles[0].children.length).toBe(0);
        const bad = page('<h1>Hi</h1>', { changes: [{ selector: 'page', action: 'css', value: 'h1{background:url(https://x.test/p)}' }, { selector: 'page', action: 'css', value: '</style><img src=x onerror=alert(1)>' }] });
        expect(bad.document.querySelectorAll('style[data-fabt-css]').length).toBe(0);
        expect(bad.document.querySelector('img')).toBeNull();
    });

    it('the editor offers move up and down, page CSS and the window width', () => {
        expect(visual).toContain('data-a="up"');
        expect(visual).toContain('data-a="down"');
        expect(visual).toContain('data-f="css"');
        expect(visual).toMatch(/Window width: /);
        expect(visual).toContain('data-a="min"');
    });
});
