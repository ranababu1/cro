/**
 * Legal page settings in one place. The pages under /legal are a standard starting draft (see docs/currentstate.md):
 * fill in the operator details below and have the text reviewed before relying on it.
 *
 * Bump LEGAL_VERSION whenever the Terms or Privacy Policy change in substance. New sign-ups record the version they
 * accepted (users.terms_version).
 */
export const LEGAL_VERSION = '2026-11-05';
/** Shown as "Last updated" on every legal page. */
export const LEGAL_UPDATED = '5 November 2026';

export const LEGAL = {
    /** Brand the service is offered under. */
    service: 'freeabtest.com',
    /** Registered legal name of the operator, for example "Example Labs Private Limited". null: the pages name the service only. */
    entity: null as string | null,
    /** Registered address of the operator. null: left out. */
    address: null as string | null,
    /** Country whose law governs the Terms, for example "India". null: the clause names the operator's place of business. */
    governingLaw: null as string | null,
    /** Where legal, privacy and support mail goes. */
    contactEmail: 'hello@freeabtest.com',
    privacyEmail: 'hello@freeabtest.com',
    securityEmail: 'hello@freeabtest.com',
} as const;

/** "Example Labs Private Limited (freeabtest.com)", or just the service name until the entity is set. */
export function operatorName(): string {
    return LEGAL.entity ? `${LEGAL.entity} (${LEGAL.service})` : LEGAL.service;
}

export const LEGAL_PAGES = [
    { slug: 'terms', title: 'Terms of Service' },
    { slug: 'privacy', title: 'Privacy Policy' },
    { slug: 'dpa', title: 'Data Processing Agreement' },
    { slug: 'cookies', title: 'Cookies and storage' },
] as const;
