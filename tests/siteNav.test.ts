import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { FOOTER_COLUMNS, NAV_LINKS, NAV_MENUS, allChromeHrefs } from '@/app/components/site/nav';
import { anchorExists, routeExists } from './helpers/links';

const root = path.join(__dirname, '..');
const read = (f: string) => fs.readFileSync(path.join(root, f), 'utf8');

describe('marketing navigation', () => {
    it('has the four mega menus and Pricing, each menu with grouped items and short descriptions', () => {
        expect(NAV_MENUS.map((m) => m.label)).toEqual(['Product', 'Solutions', 'Developers', 'Resources']);
        expect(NAV_LINKS).toEqual([{ href: '/pricing', title: 'Pricing' }]);
        for (const m of NAV_MENUS) {
            expect(m.groups.length).toBeGreaterThanOrEqual(2);
            const items = m.groups.flatMap((g) => g.items);
            expect(items.length).toBeLessThanOrEqual(8);
            for (const i of items) { expect(i.body.length).toBeGreaterThan(10); expect(i.body.length).toBeLessThanOrEqual(60); }
        }
    });

    it('links only to pages and anchors that exist', () => {
        for (const href of allChromeHrefs()) {
            expect(href.startsWith('/'), href).toBe(true);
            const [pathname, hash] = href.split('#');
            expect(routeExists(pathname), href).toBe(true);
            if (hash) expect(anchorExists(pathname, hash), href).toBe(true);
        }
    });

    it('footer keeps the legal, company and contact links', () => {
        const hrefs = FOOTER_COLUMNS.flatMap((c) => c.links.map((l) => l.href));
        for (const h of ['/about', '/contact', '/security', '/legal/terms', '/legal/privacy', '/legal/cookies', '/legal/refunds', '/legal/delivery', '/legal/dpa']) expect(hrefs).toContain(h);
    });

    it('header has Sign in and Start for free, and stays out of the signed-in app', () => {
        const header = read('app/components/site/SiteHeader.tsx');
        expect(header).toMatch(/>Sign in</); expect(header).toContain('Start for free');
        expect(read('app/components/shell/AppShell.tsx')).not.toMatch(/components\/site/);
        expect(read('app/(app)/layout.tsx')).not.toMatch(/components\/site/);
    });

    it('desktop menu closes on Escape and outside click and exposes aria-expanded', () => {
        const src = read('app/components/site/MegaNav.tsx');
        expect(src).toContain("e.key !== 'Escape'"); expect(src).toContain("'mousedown'");
        expect(src).toContain('aria-expanded={isOpen}'); expect(src).toContain('aria-controls={id}');
        expect(src).toContain('aria-label="Main"');
    });

    it('every public page that used the old chrome uses the new header and footer', () => {
        for (const f of ['app/page.tsx', 'app/pricing/page.tsx', 'app/blog/page.tsx', 'app/blog/[slug]/page.tsx', 'app/wordpress/page.tsx', 'app/legal/LegalDoc.tsx']) {
            const src = read(f);
            expect(src, f).toMatch(/components\/site'/);
            expect(src, f).toContain('<SiteHeader />'); expect(src, f).toContain('<SiteFooter />');
        }
        expect(fs.existsSync(path.join(root, 'app/components/landing/SiteChrome.tsx'))).toBe(false);
    });
});
