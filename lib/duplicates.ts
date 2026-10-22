import { createHash } from 'node:crypto';
import { parsePhoneNumberFromString, type CountryCode } from 'libphonenumber-js';
import { db } from './db';
import { registrableDomain } from './domainLedger';

/**
 * Duplicate-account flags for platform admins (/admin/duplicates). Accounts are grouped when they share
 * a phone number (from the profile step, normalised to E.164), the hashed sign-up IP (users.signup_ip_hash,
 * a salted hash, never the raw IP) or a registrable domain. Only groups spanning two or more orgs are flagged.
 * Nothing is blocked automatically; admins suspend or unsuspend from the list (lib/suspension.ts).
 */
export type DuplicateKind = 'phone' | 'signup_ip' | 'domain';

export interface DuplicateOrg {
    id: string;
    name: string;
    plan: string;
    status: 'active' | 'suspended';
    emails: string[];
}

export interface DuplicateGroup {
    kind: DuplicateKind;
    /** Shown to admins: a masked phone, a short IP hash or the domain. */
    label: string;
    /** Stable id for the group: kind plus a short hash of the shared value (no raw phone in it). */
    key: string;
    orgs: DuplicateOrg[];
}

/** E.164 when the number parses (with the profile country as a hint), else digits with a leading +. Null when too short. */
export function normalizePhone(raw: string | null | undefined, country?: string | null): string | null {
    if (!raw) return null;
    const parsed = parsePhoneNumberFromString(raw, (country || undefined) as CountryCode | undefined);
    if (parsed?.isValid()) return parsed.number;
    const digits = raw.replace(/\D/g, '').replace(/^00/, '');
    return digits.length >= 7 ? `+${digits}` : null;
}

export function maskPhone(e164: string): string {
    return e164.length <= 6 ? e164 : `${e164.slice(0, 3)}${'*'.repeat(Math.max(0, e164.length - 7))}${e164.slice(-4)}`;
}

type OrgInfo = { org_id: string; org_name: string; org_plan: string; org_status: 'active' | 'suspended'; email?: string };

function collect(map: Map<string, Map<string, DuplicateOrg>>, key: string, o: OrgInfo) {
    let orgs = map.get(key);
    if (!orgs) map.set(key, (orgs = new Map()));
    let org = orgs.get(o.org_id);
    if (!org) orgs.set(o.org_id, (org = { id: o.org_id, name: o.org_name, plan: o.org_plan, status: o.org_status, emails: [] }));
    if (o.email && !org.emails.includes(o.email)) org.emails.push(o.email);
}

export async function findDuplicateGroups(): Promise<DuplicateGroup[]> {
    const [members, hosts] = await Promise.all([db.listMembersForDuplicates(), db.listOrgHosts()]);
    const byPhone = new Map<string, Map<string, DuplicateOrg>>();
    const byIp = new Map<string, Map<string, DuplicateOrg>>();
    const byDomain = new Map<string, Map<string, DuplicateOrg>>();
    const emailsByOrg = new Map<string, string[]>();
    for (const m of members) {
        emailsByOrg.set(m.org_id, [...new Set([...(emailsByOrg.get(m.org_id) ?? []), m.email])]);
        const phone = normalizePhone(m.phone, m.country);
        if (phone) collect(byPhone, phone, m);
        if (m.signup_ip_hash) collect(byIp, m.signup_ip_hash, m);
    }
    for (const h of hosts) {
        const domain = registrableDomain(h.host);
        if (domain) collect(byDomain, domain, h);
    }
    const groups: DuplicateGroup[] = [];
    const push = (kind: DuplicateKind, map: Map<string, Map<string, DuplicateOrg>>, label: (k: string) => string) => {
        for (const [k, orgs] of map) {
            if (orgs.size < 2) continue;
            const list = [...orgs.values()].map((o) => ({ ...o, emails: o.emails.length ? o.emails : emailsByOrg.get(o.id) ?? [] }));
            groups.push({ kind, key: `${kind}:${createHash('sha256').update(k).digest('hex').slice(0, 16)}`, label: label(k), orgs: list.sort((a, b) => a.name.localeCompare(b.name)) });
        }
    };
    push('phone', byPhone, maskPhone);
    push('signup_ip', byIp, (k) => `IP hash ${k.slice(0, 10)}`);
    push('domain', byDomain, (k) => k);
    return groups.sort((a, b) => b.orgs.length - a.orgs.length || a.key.localeCompare(b.key));
}
