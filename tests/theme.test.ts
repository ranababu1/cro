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

    it('uses the approved indigo palette on a neutral canvas, not a site-wide gradient', () => {
        expect(css).toContain('--color-accent-600: #6366f1;');
        expect(css).toContain('--color-accent-700: #4338ca;');
        expect(css).toContain('--color-accent-800: #312e81;');
        expect(css).toContain('--color-accent-50: #eef2ff;');
        expect(css).toContain('--color-accent-100: #e0e7ff;');
        expect(css).toContain('--color-canvas: #fafbff;');
        expect(css).toContain('--color-line: #e5e7eb;');
        expect(css).toContain('--background-image-hero-glow:');
        expect(css).toContain('--background-image-btn-primary:');
        expect(css).not.toContain('--background-image-site-gradient');
        expect(css).not.toContain('#6f7cf5');
        expect(css).not.toContain('#16a36a');
        expect(css).not.toContain('#0f7a52');
        expect(fs.readFileSync('app/components/site/SitePage.tsx', 'utf8')).toContain('bg-canvas');
        expect(fs.readFileSync('app/page.tsx', 'utf8')).toContain('bg-canvas');
        expect(fs.readFileSync('app/page.tsx', 'utf8')).toContain('hero-glow');
        const blocks = fs.readFileSync('app/components/site/Blocks.tsx', 'utf8');
        expect(blocks).not.toMatch(/PageHero[\s\S]*bg-surface/);
        expect(blocks).toContain("variant={i === 0 ? 'primary' : 'secondary'}");
        expect(blocks).toContain('cta-band');
        expect(blocks).toContain('variant="onDark"');
        expect(fs.readFileSync('app/components/site/Buttons.tsx', 'utf8')).toContain('btn-primary');
    });

    it('the footer copyright is only the service name and year', () => {
        expect(footer).toContain('© {new Date().getFullYear()} FREEABTEST');
        expect(footer).not.toContain('LEGAL.entity');
    });
});
