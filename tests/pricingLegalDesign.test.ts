import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { LEGAL } from '@/lib/legal';
import { PLAN_PRICES_USD } from '@/lib/billing/config';
import { checkHref, hrefsIn } from './helpers/links';

const read = (f: string) => fs.readFileSync(f, 'utf8');
const pricing = read('app/pricing/page.tsx');
const cards = read('app/pricing/BillingCards.tsx');
const legalDoc = read('app/legal/LegalDoc.tsx');
const OLD_STYLE = /#0b1630|#f8faff|#2563eb|#14b8a6|blue-600|blue-700|blue-50\b|teal-|zinc-|bg-gradient-to-|text-brand-700/;

describe('pricing and legal pages use the site design', () => {
    it('pricing, plan cards and the legal frame use the site tokens only', () => {
        for (const [f, src] of [['pricing', pricing], ['cards', cards], ['LegalDoc', legalDoc]] as const) {
            expect(src, f).not.toMatch(OLD_STYLE);
            expect(src, f).toMatch(/navy-950/);
        }
    });

    it('pricing keeps its numbers, the Free card wording and the compare table', () => {
        expect(cards).toContain(`{ name: 'Starter', monthly: ${PLAN_PRICES_USD.starter.monthly}, yearly: ${PLAN_PRICES_USD.starter.yearly}`);
        expect(cards).toContain(`{ name: 'Growth', monthly: ${PLAN_PRICES_USD.growth.monthly}, yearly: ${PLAN_PRICES_USD.growth.yearly}`);
        expect(cards).toContain("Free: ['Up to 10,000 tested visitors a month', '1 project', '1 domain']");
        expect(pricing).toContain('<section id="compare"');
        expect(pricing).toContain('<section id="faq"');
        expect(pricing).toContain('Pay yearly and get 2 months free: Starter $200/yr (about $16.67/mo), Growth $500/yr.');
        expect(pricing).toContain("path: '/pricing'");
        expect(pricing).toContain('faqPageNode(faqs)');
        expect(pricing).toContain('<JsonLd')
        expect(pricing.match(/<h1/g)).toHaveLength(1);
        for (const h of [...hrefsIn(pricing), ...hrefsIn(cards)].filter((h) => h.startsWith('/'))) expect(checkHref(h), h).toBeNull();
    });

    it('legal facts are unchanged', () => {
        expect(LEGAL.entity).toBe('FREEABTEST');
        expect(LEGAL.address).toBe('5A-606, Provident Park Square, Kanakpura Rd, Judicial Layout 2nd Phase, Vakil Garden City, Mallasandra, Bengaluru, Karnataka 560109, India');
        expect(LEGAL.governingLaw).toBe('India');
        expect(LEGAL.governingCourts).toBe('the courts of Bengaluru');
        expect(LEGAL.contactPhone).toBe('+91 9964 180587');
        const terms = read('app/legal/terms/page.tsx');
        expect(terms).toMatch(/Downgrades and cancellations take effect at the end of the current billing period/);
        expect(terms).toMatch(/We do not give mid-cycle refunds/);
    });

    it('the legal frame keeps the shared header, footer, last updated date and document links', () => {
        expect(legalDoc).toContain('<SiteHeader />');
        expect(legalDoc).toContain('<SiteFooter />');
        expect(legalDoc).toContain('Last updated {LEGAL_UPDATED}');
        expect(legalDoc).toContain('aria-label="Legal documents"');
        expect(legalDoc).toContain("aria-current={p.slug === slug ? 'page' : undefined}");
        expect(legalDoc).toMatch(/\[&_table\]:overflow-x-auto/);
    });
});

describe('short legal URLs redirect permanently', () => {
    it('/privacy, /terms and /cookie-policy 301 to the legal pages', async () => {
        const config = (await import('../next.config.js')).default as { redirects: () => Promise<{ source: string; destination: string; statusCode?: number }[]> };
        const rules = await config.redirects();
        for (const [source, destination] of [['/privacy', '/legal/privacy'], ['/terms', '/legal/terms'], ['/cookie-policy', '/legal/cookies']]) {
            expect(rules).toContainEqual(expect.objectContaining({ source, destination, statusCode: 301 }));
            expect(checkHref(destination)).toBeNull();
            expect(fs.existsSync(`app${source}/page.tsx`)).toBe(false);
        }
    });
});
