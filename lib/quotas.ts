import { db, monthStartIso } from './db';

/**
 * Basic plan quota checks. Limits live on the organization (null = unlimited) and reset each calendar month (UTC).
 * These run a count query per call. Before high traffic, cache usage per org or move it to the rollup job.
 */
export interface QuotaCheck {
    allowed: boolean;
    limit: number | null;
    used: number;
}

/** New visitors are not enrolled once the org has used its monthly visitor limit. Existing visitors keep their variant. */
export async function checkVisitorQuota(orgId: string): Promise<QuotaCheck> {
    const org = await db.getOrganization(orgId);
    const limit = org?.monthly_visitor_limit ?? null;
    if (limit === null) return { allowed: true, limit, used: 0 };
    const { visitors } = await db.getOrgUsage(orgId, monthStartIso());
    return { allowed: visitors < limit, limit, used: visitors };
}

/** Starting a new experiment is blocked once the org has started its monthly limit. Resuming a paused one is not. */
export async function checkExperimentStartQuota(orgId: string): Promise<QuotaCheck> {
    const org = await db.getOrganization(orgId);
    const limit = org?.monthly_experiment_limit ?? null;
    if (limit === null) return { allowed: true, limit, used: 0 };
    const used = await db.countExperimentsStartedSince(orgId, monthStartIso());
    return { allowed: used < limit, limit, used };
}
