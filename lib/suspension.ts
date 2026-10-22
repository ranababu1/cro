import { db } from './db';
import { clearConfigCache } from './configCache';
import { clearPageviewCache } from './pageviewQuota';

/**
 * Suspend or unsuspend an org (platform admins). Enforced on the server everywhere the org is used:
 * SDK keys get 403 and serve nothing (lib/requestAuth authenticateSdkRequest), secret keys and dashboard APIs
 * get 403, and the signed-in app shows the suspended notice (app/(app)/layout.tsx). Other instances pick up
 * the change within the config cache TTL (45 s). Every change is written to the audit log and the abuse log.
 */
export async function setOrgSuspended(
    orgId: string,
    suspend: boolean,
    admin: { userId: string; email: string },
    opts: { reason?: string | null; source: 'duplicates' | 'tenant' ; group?: string | null },
): Promise<{ changed: boolean; status: 'active' | 'suspended' } | null> {
    const org = await db.getOrganization(orgId);
    if (!org) return null;
    const status = suspend ? 'suspended' : 'active';
    if (org.status === status) return { changed: false, status };
    await db.updateOrganization(orgId, suspend ? { status, suspended_reason: opts.reason ?? null } : { status });
    clearConfigCache();
    clearPageviewCache();
    await logSuspension(orgId, suspend, admin, { ...opts, before: org.status });
    return { changed: true, status };
}

/** The abuse log entry for a suspension change (the tenant PATCH route writes its own audit entry). */
export async function logSuspensionAbuse(
    orgId: string,
    suspend: boolean,
    admin: { userId: string; email: string },
    opts: { reason?: string | null; source: 'duplicates' | 'tenant'; group?: string | null },
): Promise<void> {
    const detail = { by: admin.email, source: opts.source, ...(opts.reason ? { reason: opts.reason } : {}), ...(opts.group ? { group: opts.group } : {}) };
    await db.addAbuseEvent({ kind: suspend ? 'org_suspended' : 'org_unsuspended', orgId, actorId: admin.userId, detail });
}

/** Audit plus abuse log entries for a suspension change. */
export async function logSuspension(
    orgId: string,
    suspend: boolean,
    admin: { userId: string; email: string },
    opts: { reason?: string | null; source: 'duplicates' | 'tenant'; group?: string | null; before?: string },
): Promise<void> {
    const detail = { by: admin.email, source: opts.source, ...(opts.reason ? { reason: opts.reason } : {}), ...(opts.group ? { group: opts.group } : {}) };
    await db.audit({
        orgId, actorId: admin.userId, entity: 'organization', entityId: orgId,
        action: suspend ? 'admin:suspend' : 'admin:reactivate',
        diff: { before: { status: opts.before ?? (suspend ? 'active' : 'suspended') }, after: { status: suspend ? 'suspended' : 'active' }, ...detail },
    });
    await logSuspensionAbuse(orgId, suspend, admin, opts);
}
