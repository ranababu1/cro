import { db } from './db';
import { getOrgEntitlements } from './entitlements';
import { formatResetDate, monthResetAt, testsCreatedThisMonth } from './freeTests';
import { getVisitorUsage } from './quotas';

export interface PlanUsageRow { label: string; used: number; limit: number | null; atLimit: string; capacity?: boolean }

/** Usage against the plan's limits for an organization. Shared by Overview and Settings, Billing. */
export async function getPlanUsage(orgId: string): Promise<{ plan: string; rows: PlanUsageRow[]; note?: string }> {
    const ent = await getOrgEntitlements(orgId);
    const { limits } = ent;
    const v = await getVisitorUsage(orgId);
    const running = await db.countRunningExperiments(orgId);
    const projects = (await db.getOrgProjects(orgId)).length;
    const newTests = await testsCreatedThisMonth('org', orgId);
    const note = limits.maxGoals !== null && limits.maxGoals <= 1 && limits.maxVariations === 1
        ? 'Each test: 1 page URL, A/B only (control plus 1 variation) and 1 goal, a click on a CSS selector.'
        : undefined;
    const rows: PlanUsageRow[] = [
        { label: 'Tested visitors this month', used: v.month, limit: limits.monthlyVisitors, atLimit: 'New visitors see your original page and are not counted until next month. Visitors already in a test keep their version.' },
        { label: 'Tested visitors today', used: v.day, limit: limits.dailyVisitors, atLimit: 'New visitors see your original page and are not counted until tomorrow (UTC). Visitors already in a test keep their version.' },
        { label: 'Running tests', used: running, limit: limits.activeExperiments, atLimit: 'Pause or complete it before you start another.', capacity: true },
        { label: 'New tests this month', used: newTests, limit: limits.monthlyTests, atLimit: `You can create your next test on ${formatResetDate(monthResetAt())}. Deleting a test does not give it back.` },
        { label: 'Projects', used: projects, limit: limits.projects, atLimit: limits.projects === 1 ? 'Your plan includes one project. Upgrade to add more.' : `Your plan includes ${limits.projects} projects. Upgrade to add more.`, capacity: true },
    ];
    return { plan: ent.plan, rows, note };
}
