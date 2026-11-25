import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { DOC_LINKS, ENDPOINTS, INTEGRATIONS, KEY_TYPES, SDK_METHODS, SITE_HOST, SNIPPETS, WEBHOOK_EVENTS } from '@/lib/site/developers';
import { FOOTER_COLUMNS, NAV_MENUS } from '@/app/components/site/nav';
import { checkHref, hrefsIn } from './helpers/links';

const read = (f: string) => fs.readFileSync(f, 'utf8');
const page = read('app/developers/page.tsx');
const content = read('lib/site/developers.ts');
const docs = ['sdk', 'serverSide', 'restApi', 'environments', 'webhooks'].map((f) => read(`lib/docs/content/${f}.ts`)).join('\n')
    .replace(/\\\\/g, '\\').replace(/https:\/\/YOUR-HOST/g, SITE_HOST);
const snip = (id: string) => SNIPPETS.find((s) => s.id === id)!.code;

describe('developers hub', () => {
    it('has its own metadata, breadcrumb and the brief sections', () => {
        expect(page).toContain("path: '/developers'");
        expect(page).toMatch(/title: 'Developers: [^']+'/);
        expect(page).toContain("<Breadcrumbs items={[{ href: '/developers', label: 'Developers' }]} />");
        for (const id of ['examples', 'sdk', 'api', 'keys', 'webhooks', 'integrations']) expect(page).toContain(`id="${id}"`);
        expect(page).toContain('Four steps to a running test');
    });

    it('code samples match the documented SDK and API contract', () => {
        expect(docs).toContain(snip('browser'));
        expect(docs).toContain(snip('events'));
        expect(docs).toContain(snip('bootstrap').split('\n').slice(0, 4).join('\n'));
        expect(docs).toContain(snip('server'));
        expect(snip('results')).toContain('/api/experiments/exp_123/results?environment=prod');
        expect(docs).toMatch(/environment=dev\|staging\|pro/);
        for (const e of ENDPOINTS) expect(docs, e.path).toContain(e.path.replace('{variationId}', '{variationId}'));
        for (const w of WEBHOOK_EVENTS) expect(docs, w.name).toContain(`\`${w.name}\``);
        for (const k of KEY_TYPES) expect(docs).toContain(k.format.replace('...', ''));
        expect(page).not.toMatch(/npm install|requests per minute|POST \/api\/experiments'/);
        expect(page).toContain('Experiments are created in the dashboard.');
    });

    it('plan notes follow the docs', () => {
        const plan = (n: string) => SDK_METHODS.find((m) => m.name.startsWith(n))!.plan;
        expect(plan('track(')).toBe('Paid plans');
        expect(plan('trackConversion(')).toBe('Paid plans');
        for (const n of ['bootstrap(', 'init(', 'getUserId(', 'consent(']) expect(plan(n)).toBe('Every plan');
        expect(page).toMatch(/Webhooks<\/p><PlanBadge plan="Paid plans" \/>/);
        expect(INTEGRATIONS.every((i) => i.plan === 'Every plan')).toBe(true);
        expect(INTEGRATIONS.find((i) => i.title === 'WordPress')!.body).toContain('plugin on paid plans');
    });

    it('every link goes to a page or anchor that exists', () => {
        const hrefs = [page, content].flatMap(hrefsIn);
        expect(hrefs.length).toBeGreaterThan(30);
        expect([...hrefs, ...DOC_LINKS.map((d) => d.href)].map(checkHref).filter(Boolean)).toEqual([]);
    });

    it('menu, footer, homepage and sitemap point at /developers', () => {
        const items = NAV_MENUS.find((m) => m.label === 'Developers')!.groups.flatMap((g) => g.items);
        expect(items[0]).toMatchObject({ href: '/developers', title: 'Developer hub' });
        expect(FOOTER_COLUMNS.find((c) => c.heading === 'Developers')!.links[0].href).toBe('/developers');
        const home = read('app/page.tsx');
        expect((home.match(/href="\/developers"/g) ?? []).length).toBeGreaterThanOrEqual(2);
        expect(read('app/sitemap.ts')).toContain("'/developers'");
    });

    it('copy stays honest and plain', () => {
        for (const src of [page, content]) {
            expect(src).not.toMatch(/z-tests? (decides?|picks)|Bayesian|guarantee|unlimited|free trial|—/i);
            expect(src).not.toMatch(/seamless|effortless|unlock|supercharge|leverage|elevate|empower|cutting-edge|game-changer|revolutioni[sz]e|delve|robust|world-class|best-in-class|blazing/i);
        }
    });
});
