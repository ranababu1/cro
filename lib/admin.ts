import { db, monthStartIso } from './db';
import { memberEntitlements } from './entitlements';

export async function getTenantSummary(orgId: string) {
    const org = await db.getOrganization(orgId);
    if (!org) return null;
    const [members, projects, usageMonth, usageTotal] = await Promise.all([
        db.getOrgMembers(orgId),
        db.getOrgProjects(orgId),
        db.getOrgUsage(orgId, monthStartIso()),
        db.getOrgUsage(orgId),
    ]);
    // Effective plan as the tenant sees it, and where it comes from. Computed fresh (not cached) so admin changes show at once.
    const ent = memberEntitlements(org, members);
    const plan = { effective: ent.plan, source: ent.planSource, billing: ent.billingPlan };
    return { org, members, projects, plan, usage: { month: usageMonth, total: usageTotal } };
}

export type TenantSummary = NonNullable<Awaited<ReturnType<typeof getTenantSummary>>>;

export async function listTenants(): Promise<TenantSummary[]> {
    const orgs = await db.listOrganizations();
    const all = await Promise.all(orgs.map((o) => getTenantSummary(o.id)));
    return all.filter((t): t is TenantSummary => t !== null);
}
