/**
 * @vitest-environment happy-dom
 */
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { focusableIn, trapTab } from '@/app/components/overlay';
import { mobileGroups, mobileLinks } from '@/app/components/landing/SiteChrome';

const root = path.join(__dirname, '..');
const read = (f: string) => fs.readFileSync(path.join(root, f), 'utf8');

function panel() {
    document.body.innerHTML = '<div id="p"><a href="/a">A</a><button>B</button><button disabled>X</button><a href="/c">C</a></div><button id="out">out</button>';
    return document.getElementById('p') as HTMLElement;
}
const tab = (shiftKey = false) => new KeyboardEvent('keydown', { key: 'Tab', shiftKey, cancelable: true });

describe('focus trap', () => {
    it('lists only enabled focusable elements', () => {
        expect(focusableIn(panel()).map((e) => e.textContent)).toEqual(['A', 'B', 'C']);
    });

    it('wraps Tab from last to first and Shift+Tab from first to last', () => {
        const p = panel(); const [a, , c] = focusableIn(p);
        c.focus(); const e1 = tab(); expect(trapTab(e1, p)).toBe(true); expect(document.activeElement).toBe(a); expect(e1.defaultPrevented).toBe(true);
        a.focus(); expect(trapTab(tab(true), p)).toBe(true); expect(document.activeElement).toBe(c);
    });

    it('pulls focus back in from outside and ignores other keys', () => {
        const p = panel(); (document.getElementById('out') as HTMLElement).focus();
        expect(trapTab(tab(), p)).toBe(true); expect(document.activeElement?.textContent).toBe('A');
        expect(trapTab(new KeyboardEvent('keydown', { key: 'Enter' }), p)).toBe(false);
    });
});

describe('mobile nav', () => {
    it('holds every desktop header link plus Docs, Pricing, Blog and Roadmap', () => {
        const chrome = read('app/components/landing/SiteChrome.tsx');
        const all = [...mobileLinks.map((l) => l.href), ...mobileGroups.flatMap((g) => g.items.map((i) => i.href))];
        for (const href of ['/pricing', '/blog', '/docs', '/roadmap']) expect(all).toContain(href);
        const desktop = [...chrome.slice(chrome.indexOf('aria-label="Main"'), chrome.indexOf('</nav>', chrome.indexOf('aria-label="Main"'))).matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
        for (const href of desktop) expect(all).toContain(href);
        expect(mobileGroups.map((g) => g.label)).toEqual(['Product', 'Use cases', 'Resources']);
    });

    it('menu has Sign in, Start free, aria-expanded and is hidden from lg up', () => {
        const src = read('app/components/landing/MobileNav.tsx');
        expect(src).toMatch(/>Sign in</); expect(src).toMatch(/Start free/);
        expect(src).toContain('aria-expanded={open}'); expect(src).toContain('aria-controls');
        expect(src).toContain('lg:hidden'); expect(src).toContain('useOverlay(');
    });

    it('overlay hook closes on Escape, outside click and route change, and locks scroll', () => {
        const src = read('app/components/overlay.ts');
        expect(src).toContain("e.key === 'Escape'"); expect(src).toContain("'mousedown'"); expect(src).toContain('data-overlay-backdrop');
        expect(src).toContain('[pathname]'); expect(src).toContain("document.body.style.overflow = 'hidden'");
    });

    it('signed-in app drawer uses the same overlay behaviour', () => {
        const src = read('app/components/shell/AppShell.tsx');
        expect(src).toContain('useOverlay(mobileOpen'); expect(src).toContain('aria-expanded={mobileOpen}'); expect(src).toContain('role="dialog"');
    });

    it('animations respect reduced motion', () => {
        const css = read('app/globals.css');
        expect(css).toMatch(/prefers-reduced-motion: no-preference\) \{\s*\.mnav-fade/);
    });
});
