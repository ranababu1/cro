import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { LEGAL, LEGAL_VERSION, contactPhoneHref, operatorName, organizationJsonLd } from '@/lib/legal';

const ADDRESS =
    '5A-606, Provident Park Square, Kanakpura Rd, Judicial Layout 2nd Phase, Vakil Garden City, Mallasandra, Bengaluru, Karnataka 560109, India';

const policyFiles = [
    'lib/legal.ts',
    'app/about/page.tsx',
    'app/contact/page.tsx',
    'app/legal/terms/page.tsx',
    'app/legal/privacy/page.tsx',
    'app/legal/refunds/page.tsx',
    'app/legal/delivery/page.tsx',
];

describe('operator details', () => {
    it('names the legal entity, Razorpay KYC address, Bengaluru courts and contact phone', () => {
        expect(LEGAL.entity).toBe('FREEABTEST');
        expect(LEGAL.address).toBe(ADDRESS);
        expect(LEGAL.governingLaw).toBe('India');
        expect(LEGAL.governingCourts).toBe('the courts of Bengaluru');
        expect(LEGAL.contactEmail).toBe('hello@freeabtest.com');
        expect(LEGAL.contactPhone).toBe('+91 9964 180587');
        expect(contactPhoneHref()).toBe('tel:+919964180587');
        expect(operatorName()).toBe('FREEABTEST');
        expect(LEGAL_VERSION).toBe('2026-11-26');
        const org = organizationJsonLd();
        expect(org.legalName).toBe(LEGAL.entity);
        expect(org.address.postalCode).toBe('560109');
        expect(org.address.addressCountry).toBe('IN');
    });

    it('prints the same address on About, Contact, Terms and Privacy, and the same phone and email on every policy page', () => {
        for (const f of ['app/about/page.tsx', 'app/contact/page.tsx', 'app/legal/terms/page.tsx', 'app/legal/privacy/page.tsx']) {
            expect(fs.readFileSync(f, 'utf8'), f).toContain('LEGAL.address');
        }
        for (const f of ['app/about/page.tsx', 'app/contact/page.tsx', 'app/legal/terms/page.tsx', 'app/legal/privacy/page.tsx', 'app/legal/refunds/page.tsx', 'app/legal/delivery/page.tsx']) {
            const src = fs.readFileSync(f, 'utf8');
            expect(src, f).toMatch(/LEGAL\.(contactEmail|privacyEmail)/);
            expect(src, f).toContain('LEGAL.contactPhone');
        }
        expect(fs.readFileSync('lib/legal.ts', 'utf8')).toContain(ADDRESS);
    });
});

describe('billing terms', () => {
    it('state no mid-cycle refunds, period-end cancel and downgrade, and do not claim checkout is live', () => {
        const terms = fs.readFileSync('app/legal/terms/page.tsx', 'utf8');
        const refunds = fs.readFileSync('app/legal/refunds/page.tsx', 'utf8');
        const delivery = fs.readFileSync('app/legal/delivery/page.tsx', 'utf8');
        for (const src of [terms, refunds]) {
            expect(src).toMatch(/do not give mid-cycle refunds/i);
            expect(src).toMatch(/end of the current billing period/);
        }
        expect(terms).toContain('When paid checkout is available');
        expect(terms).not.toMatch(/checkout is (now |already )?live/i);
        expect(delivery).toMatch(/digital service/);
        expect(delivery).toMatch(/do not sell or ship physical goods/i);
        expect(delivery).toContain('When paid checkout is available');
    });
});

describe('policy page copy', () => {
    it('has no em dashes or internal terms', () => {
        for (const f of policyFiles) {
            const src = fs.readFileSync(f, 'utf8');
            expect(src, `${f} has an em dash`).not.toMatch(/\u2014/);
            expect(src, f).not.toMatch(/github\.com/i);
            expect(src, f).not.toMatch(/\b(vercel|turso|next\.js|drizzle)\b/i);
        }
    });

    it('does not use the personal operator name in public page source', () => {
        const files = [
            'lib/legal.ts',
            'app/about/page.tsx',
            'app/contact/page.tsx',
            'app/legal/terms/page.tsx',
            'app/legal/privacy/page.tsx',
            'app/legal/dpa/page.tsx',
            'app/legal/cookies/page.tsx',
            'app/legal/refunds/page.tsx',
            'app/legal/delivery/page.tsx',
            'app/security/page.tsx',
            'app/components/site/SiteFooter.tsx',
            'app/page.tsx',
            'app/layout.tsx',
        ];
        for (const f of files) {
            const src = fs.readFileSync(f, 'utf8');
            expect(src, f).not.toMatch(/Imranul|Mazumder|trading as/i);
        }
    });
});
