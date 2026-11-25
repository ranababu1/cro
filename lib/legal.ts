/**
 * Legal page settings in one place. The pages under /legal, /about and /contact are a starting draft
 * (see docs/currentstate.md): have the text reviewed before relying on it.
 *
 * Bump LEGAL_VERSION whenever the Terms or Privacy Policy change in substance. New sign-ups record the version they
 * accepted (users.terms_version).
 */
export const LEGAL_VERSION = '2026-11-25';
/** Shown as "Last updated" on every legal page. */
export const LEGAL_UPDATED = '25 November 2026';

export const LEGAL = {
    /** Brand the service is offered under. */
    service: 'freeabtest.com',
    /** Registered legal name of the operator. */
    entity: 'Imranul Haque Mazumder, trading as FREEABTEST',
    /** Registered address of the operator. */
    address: '5A-606, Provident Park Square, Kanakpura Rd, Judicial Layout 2nd Phase, Vakil Garden City, Mallasandra, Bengaluru, Karnataka 560109, India',
    /** Country whose law governs the Terms. */
    governingLaw: 'India',
    /** Courts that have jurisdiction under the Terms. */
    governingCourts: 'the courts of Bengaluru',
    /** Where legal, privacy and support mail goes. */
    contactEmail: 'hello@freeabtest.com',
    privacyEmail: 'hello@freeabtest.com',
    securityEmail: 'hello@freeabtest.com',
    /** Shown on the Contact page and in the Terms. */
    contactPhone: '+91 9964 180587',
    siteUrl: 'https://www.freeabtest.com',
} as const;

/** "Imranul Haque Mazumder, trading as FREEABTEST (freeabtest.com)", or just the service name if the entity is unset. */
export function operatorName(): string {
    return LEGAL.entity ? `${LEGAL.entity} (${LEGAL.service})` : LEGAL.service;
}

/** tel: link for the published contact phone. */
export function contactPhoneHref(): string {
    return `tel:${LEGAL.contactPhone.replace(/[^\d+]/g, '')}`;
}

export const COMPANY_PAGES = [
    { slug: 'about', href: '/about', title: 'About' },
    { slug: 'contact', href: '/contact', title: 'Contact' },
] as const;

export const LEGAL_PAGES = [
    { slug: 'terms', href: '/legal/terms', title: 'Terms of Service' },
    { slug: 'privacy', href: '/legal/privacy', title: 'Privacy Policy' },
    { slug: 'dpa', href: '/legal/dpa', title: 'Data Processing Agreement' },
    { slug: 'cookies', href: '/legal/cookies', title: 'Cookies and storage' },
    { slug: 'refunds', href: '/legal/refunds', title: 'Refunds and cancellation' },
    { slug: 'delivery', href: '/legal/delivery', title: 'Service delivery' },
] as const;

/** Organization details for About and Contact JSON-LD. */
export function organizationJsonLd() {
    return {
        '@type': 'Organization',
        name: LEGAL.service,
        legalName: LEGAL.entity,
        url: LEGAL.siteUrl,
        email: LEGAL.contactEmail,
        telephone: LEGAL.contactPhone,
        address: {
            '@type': 'PostalAddress',
            streetAddress: '5A-606, Provident Park Square, Kanakpura Rd, Judicial Layout 2nd Phase, Vakil Garden City, Mallasandra',
            addressLocality: 'Bengaluru',
            addressRegion: 'Karnataka',
            postalCode: '560109',
            addressCountry: 'IN',
        },
    };
}
