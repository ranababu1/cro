import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { resolveTheme, themeInitScript, THEME_KEY } from '@/lib/theme';

describe('app theme', () => {
    it('resolves light, dark and system', () => {
        expect(resolveTheme('light', true)).toBe('light');
        expect(resolveTheme('dark', false)).toBe('dark');
        expect(resolveTheme('system', true)).toBe('dark');
        expect(resolveTheme('system', false)).toBe('light');
    });
    it('sets the theme before paint from localStorage, in the root layout head', () => {
        expect(themeInitScript).toContain(THEME_KEY);
        expect(themeInitScript).toContain('prefers-color-scheme: dark');
        const layout = fs.readFileSync('app/layout.tsx', 'utf8');
        expect(layout).toMatch(/<head>\s*<script dangerouslySetInnerHTML=\{\{ __html: themeInitScript \}\} \/>/);
        expect(layout).toContain('suppressHydrationWarning');
    });
    it('only the signed-in app opts in to dark styles', () => {
        const css = fs.readFileSync('app/globals.css', 'utf8');
        const darkRules = css.match(/html\[data-theme='dark'\][^{,]*/g) ?? [];
        expect(darkRules.length).toBeGreaterThan(5);
        for (const r of darkRules) expect(r).toContain('.app-scope');
        expect(fs.readFileSync('app/components/shell/AppShell.tsx', 'utf8')).toContain('app-scope');
        for (const f of ['app/page.tsx', 'app/pricing/page.tsx', 'app/wordpress/page.tsx', 'app/components/landing/SiteChrome.tsx']) {
            expect(fs.readFileSync(f, 'utf8')).not.toContain('app-scope');
        }
    });
});
