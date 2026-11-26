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
        for (const f of ['app/page.tsx', 'app/pricing/page.tsx', 'app/wordpress/page.tsx', 'app/components/site/SiteHeader.tsx', 'app/components/site/nav.ts']) {
            expect(fs.readFileSync(f, 'utf8')).not.toContain('app-scope');
        }
    });
});

describe('marketing colour tokens', () => {
    const css = fs.readFileSync('app/globals.css', 'utf8');
    const footer = fs.readFileSync('app/components/site/SiteFooter.tsx', 'utf8');
    const gradient = 'radial-gradient(60% 55% at 80% 20%, rgb(238, 240, 255) 0%, transparent 70%), radial-gradient(70% 60% at 12% 90%, rgb(111, 124, 245) 0%, transparent 70%), linear-gradient(160deg, rgb(174, 183, 255), rgb(217, 221, 255) 50%, rgb(179, 163, 255))';

    it('defines the site gradient once and uses it on public shells, heroes and the closing band', () => {
        expect(css).toContain(`--background-image-site-gradient: ${gradient};`);
        expect(css).toContain('--color-accent-600: #6f7cf5;');
        expect(css).toContain('--color-accent-700: #4f5bd5;');
        expect(css).toContain('--color-accent-800: #3e48c4;');
        expect(css).not.toContain('#16a36a');
        expect(css).not.toContain('#0f7a52');
        expect(fs.readFileSync('app/components/site/SitePage.tsx', 'utf8')).toContain('bg-site-gradient');
        expect(fs.readFileSync('app/page.tsx', 'utf8')).toContain('bg-site-gradient');
        const hero = fs.readFileSync('app/components/site/Blocks.tsx', 'utf8');
        expect(hero).not.toMatch(/PageHero[\s\S]*bg-surface/);
        expect(hero).toContain('variant="primary"');
        expect(hero).not.toContain('variant="onDark"');
    });

    it('the footer copyright is only the service name and year', () => {
        expect(footer).toContain('© {new Date().getFullYear()} FREEABTEST');
        expect(footer).not.toContain('LEGAL.entity');
    });
});

