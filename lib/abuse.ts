import { db } from './db';

/**
 * Abuse attempts are written to the org's audit log as `abuse:<kind>` so platform admins see them
 * in /admin/abuse. Noisy kinds (SDK origin mismatches) are throttled per org and detail per hour.
 */
export type AbuseKind = 'domain_taken' | 'domain_exhausted' | 'domain_limit' | 'origin_mismatch' | 'origin_missing' | 'plugin_unpaid' | 'plugin_verify_refused';

const THROTTLE_MS = 60 * 60_000;
const recent = new Map<string, number>();

export async function logAbuse(orgId: string, kind: AbuseKind, detail: Record<string, unknown>, actorId: string | null = null): Promise<void> {
    const key = `${orgId}|${kind}|${JSON.stringify(detail)}`;
    const last = recent.get(key);
    if (last && Date.now() - last < THROTTLE_MS) return;
    recent.set(key, Date.now());
    if (recent.size > 5000) recent.clear();
    try {
        await db.audit({ orgId, actorId, entity: 'abuse', entityId: String(detail.domain ?? detail.host ?? orgId), action: `abuse:${kind}`, diff: detail });
    } catch (err) {
        console.error('abuse log failed', err);
    }
}

export function clearAbuseThrottle(): void {
    recent.clear();
}
