import { getDomain } from 'tldts';
import { and, eq, sql } from 'drizzle-orm';
import { getDb } from './db/client';
import * as s from './db/schema';
import { db } from './db';
import { FREE_MONTHLY_TESTS } from './plans';
import { normalizeHost } from './domains';

/**
 * Free-tier anti-abuse. Every free org's domains are tracked by registrable domain (eTLD+1, from
 * the public suffix list), globally across orgs:
 *   - one free org holds a registrable domain at a time (first claim wins);
 *   - the free plan's new tests per month are counted per domain as well as per account (lib/freeTests.ts);
 *   - a domain that has used this month's free test cannot be moved to another free org until the month resets.
 * Paid orgs, special friends and admins are exempt (entitlements.freeTierRules = false).
 */

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

export function isLocalHost(host: string | null | undefined): boolean {
    if (!host) return false;
    return LOCAL_HOSTS.has(host) || host.endsWith('.localhost');
}

/** Lowercase, no www, no port, reduced to eTLD+1. sub.example.co.uk -> example.co.uk. Null for local or invalid hosts. */
export function registrableDomain(input: string | null | undefined): string | null {
    if (!input) return null;
    const host = normalizeHost(input);
    if (!host || isLocalHost(host)) return null;
    const bare = host.replace(/^www\./, '');
    return getDomain(bare, { allowPrivateDomains: false }) ?? null;
}

export const DOMAIN_FREE_TESTS = FREE_MONTHLY_TESTS;

export type ClaimResult = { ok: true; domain: string | null } | { ok: false; reason: 'domain_taken' | 'domain_exhausted'; domain: string; message: string };

export async function getLedgerEntry(domain: string) {
    const d = await getDb();
    return (await d.query.domainLedger.findFirst({ where: eq(s.domainLedger.domain, domain) })) ?? null;
}

/** Checks and records a free org's claim on a host's registrable domain. */
export async function claimDomain(orgId: string, host: string): Promise<ClaimResult> {
    const domain = registrableDomain(host);
    if (!domain) return { ok: true, domain: null };
    const d = await getDb();
    const row = await getLedgerEntry(domain);
    if (row && row.org_id !== orgId) {
        const { testsCreatedThisMonth, monthResetAt, formatResetDate } = await import('./freeTests');
        if ((await testsCreatedThisMonth('domain', domain)) >= DOMAIN_FREE_TESTS) {
            return { ok: false, reason: 'domain_exhausted', domain, message: `${domain} has already had this month's free test on another account. It can be added to a free account again on ${formatResetDate(monthResetAt())}, or upgrade to a paid plan to test it now.` };
        }
    }
    if (row?.org_id && row.org_id !== orgId) {
        return { ok: false, reason: 'domain_taken', domain, message: `${domain} is already set up on another free account. Each domain can be on one free account at a time. Upgrade to a paid plan to use it here.` };
    }
    // Insert or take over a released row. The org_id guard makes the first claim win under concurrency.
    await d.insert(s.domainLedger).values({ domain, org_id: orgId, claimed_at: new Date().toISOString() })
        .onConflictDoUpdate({ target: s.domainLedger.domain, set: { org_id: orgId, claimed_at: new Date().toISOString(), updated_at: new Date().toISOString() }, where: sql`${s.domainLedger.org_id} is null or ${s.domainLedger.org_id} = ${orgId}` });
    const after = await getLedgerEntry(domain);
    if (after?.org_id !== orgId) {
        return { ok: false, reason: 'domain_taken', domain, message: `${domain} is already set up on another free account. Each domain can be on one free account at a time. Upgrade to a paid plan to use it here.` };
    }
    return { ok: true, domain };
}

/** Releases the org's claim when it no longer has any host on that registrable domain. Usage is kept. */
export async function releaseDomainIfUnused(orgId: string, host: string): Promise<void> {
    const domain = registrableDomain(host);
    if (!domain) return;
    const projects = await db.getOrgProjects(orgId);
    for (const p of projects) {
        if ((await db.listDomains(p.id)).some((x) => registrableDomain(x.host) === domain)) return;
    }
    const d = await getDb();
    await d.update(s.domainLedger).set({ org_id: null, updated_at: new Date().toISOString() }).where(and(eq(s.domainLedger.domain, domain), eq(s.domainLedger.org_id, orgId)));
}

/** Registered non-local hosts across the org. */
export async function countOrgDomains(orgId: string): Promise<number> {
    let n = 0;
    for (const p of await db.getOrgProjects(orgId)) n += (await db.listDomains(p.id)).filter((x) => !isLocalHost(x.host)).length;
    return n;
}

export async function listLedger(limit = 200) {
    const d = await getDb();
    return d.select().from(s.domainLedger).orderBy(sql`${s.domainLedger.updated_at} desc`).limit(limit);
}
