import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { sql } from 'drizzle-orm';
import { useTempDatabase, seedProjectDomain } from './helpers';
import { db, getDb } from '@/lib/db';
import { computeEntitlements, memberEntitlements } from '@/lib/entitlements';
import { checkVisitorQuota, checkExperimentStartQuota, clearVisitorCache, quotaMessage } from '@/lib/quotas';
import { clearPageviewCache, currentMonth, getPageviewStatus } from '@/lib/pageviewQuota';
import { clearConfigCache } from '@/lib/configCache';
import { goalPlanError, MAX_GOALS } from '@/lib/goals';
import {
    STARTER_MONTHLY_VISITORS, GROWTH_MONTHLY_VISITORS, STARTER_RUNNING_EXPERIMENTS,
    PAID_MAX_GOALS, PAID_MAX_VARIATIONS, PLAN_PROJECTS, PLAN_SEATS, UNLIMITED,
    planMonthlyVisitors, planActiveExperiments, planMonthlyPageviews,
} from '@/lib/plans';

let cleanup: () => void;
let starter: { orgId: string; projectId: string; userId: string };
let growth: { orgId: string; projectId: string; userId: string };

async function tenant(email: string, plan: string) {
    const u = await db.createUser({ email, name: email });
    const ws = await db.ensureWorkspace(u);
    await db.updateOrganization(ws.orgId, { plan });
    await seedProjectDomain(ws.projectId, 'localhost');
    clearConfigCache();
    return { orgId: ws.orgId, projectId: ws.projectId, userId: u.id };
}

beforeAll(async () => {
    cleanup = useTempDatabase();
    starter = await tenant('starter@example.com', 'starter');
    growth = await tenant('growth@example.com', 'growth');
});
afterAll(() => cleanup());

describe('published paid plan defaults', () => {
    it('match the pricing page: Starter, Growth and Enterprise', () => {
        expect(planMonthlyVisitors('starter')).toBe(STARTER_MONTHLY_VISITORS);
        expect(planMonthlyVisitors('growth')).toBe(GROWTH_MONTHLY_VISITORS);
        expect(planMonthlyVisitors('enterprise')).toBeNull();
        expect(planMonthlyVisitors('team')).toBe(STARTER_MONTHLY_VISITORS);
        expect(planActiveExperiments('starter')).toBe(STARTER_RUNNING_EXPERIMENTS);
        expect(planActiveExperiments('growth')).toBeNull();
        expect(planActiveExperiments('enterprise')).toBeNull();
        expect(planMonthlyPageviews('starter')).toBeNull();
        expect(planMonthlyPageviews('growth')).toBeNull();
        expect(planMonthlyPageviews('enterprise')).toBeNull();
        expect(PAID_MAX_GOALS).toBe(MAX_GOALS);
        expect(STARTER_MONTHLY_VISITORS).toBe(250_000);
        expect(GROWTH_MONTHLY_VISITORS).toBe(1_000_000);
        expect(STARTER_RUNNING_EXPERIMENTS).toBe(20);

        expect(computeEntitlements({ plan: 'starter' }, []).limits).toMatchObject({
            monthlyVisitors: 250_000, dailyVisitors: null, activeExperiments: 20, monthlyTests: null,
            maxGoals: 50, monthlyPageviews: null, maxVariations: 50, projects: 3, seats: 5, domains: null,
        });
        expect(computeEntitlements({ plan: 'growth' }, []).limits).toMatchObject({
            monthlyVisitors: 1_000_000, dailyVisitors: null, activeExperiments: null, monthlyTests: null,
            maxGoals: 50, monthlyPageviews: null, maxVariations: 50, projects: 10, seats: 15, domains: null,
        });
        expect(computeEntitlements({ plan: 'enterprise' }, []).limits).toMatchObject({
            monthlyVisitors: null, dailyVisitors: null, activeExperiments: null, monthlyTests: null,
            maxGoals: 50, monthlyPageviews: null, maxVariations: 50, projects: null, seats: null, domains: null,
        });
        expect(PLAN_PROJECTS).toEqual([1, 3, 10, null]);
        expect(PLAN_SEATS).toEqual([1, 5, 15, null]);
        expect(PAID_MAX_VARIATIONS).toBe(50);
    });

    it('uses an assigned plan_override, not the billing plan, for those defaults', () => {
        const e = computeEntitlements({ plan: 'free', plan_override: 'starter' }, []);
        expect(e.plan).toBe('starter');
        expect(e.planSource).toBe('assigned');
        expect(e.billingPlan).toBe('free');
        expect(e.limits).toMatchObject({ monthlyVisitors: 250_000, activeExperiments: 20, projects: 3, maxGoals: 50 });
    });

    it('keeps admin owner bypass, org overrides and special-friend allowances', () => {
        const admin = memberEntitlements({ plan: 'starter' }, [{ role: 'owner', email: 'imrn.dev@gmail.com' }]);
        expect(admin.unlimited).toBe(true);
        expect(Object.values(admin.limits).every((v) => v === null)).toBe(true);

        expect(computeEntitlements({ plan: 'starter', monthly_visitor_limit: 7 }, []).limits.monthlyVisitors).toBe(7);
        expect(computeEntitlements({ plan: 'starter', monthly_visitor_limit: UNLIMITED }, []).limits.monthlyVisitors).toBeNull();
        expect(computeEntitlements({ plan: 'starter', monthly_pageview_limit: 9 }, []).limits.monthlyPageviews).toBe(9);
        expect(computeEntitlements({ plan: 'starter', monthly_pageview_limit: UNLIMITED }, []).limits.monthlyPageviews).toBeNull();

        const friend = computeEntitlements({
            plan: 'starter', special_friend: true,
            custom_allowances: JSON.stringify({ monthly_visitors: 12, active_experiments: 3, monthly_pageviews: 4 }),
        }, []);
        expect(friend.limits).toMatchObject({ monthlyVisitors: 12, activeExperiments: 3, monthlyPageviews: 4 });
    });
});

describe('quota enforcement for advertised paid caps', () => {
    it('blocks new Starter visitors at 250,000, and still lets a visitor already counted this month through', async () => {
        const month = currentMonth();
        await (await getDb()).run(sql`insert into usage_monthly (org_id, month, pageviews, visitors) values (${starter.orgId}, ${month}, 0, ${STARTER_MONTHLY_VISITORS})`);
        clearVisitorCache();
        const blocked = await checkVisitorQuota(starter.orgId, 'someone_new');
        expect(blocked).toMatchObject({ allowed: false, reason: 'monthly_visitors', limit: STARTER_MONTHLY_VISITORS, used: STARTER_MONTHLY_VISITORS });
        expect(quotaMessage(blocked)).toContain('250,000 tested visitors this month');
        expect(quotaMessage(blocked)).toContain('Upgrade for more');

        await (await getDb()).run(sql`insert into org_visitors_monthly (org_id, month, user_id) values (${starter.orgId}, ${month}, 'already')`);
        clearVisitorCache();
        expect((await checkVisitorQuota(starter.orgId, 'already')).allowed).toBe(true);
        expect((await checkVisitorQuota(growth.orgId, 'someone_new')).allowed).toBe(true);
    });

    it('blocks a 21st running test on Starter and allows it on Growth', async () => {
        const d = await getDb();
        for (let i = 0; i < STARTER_RUNNING_EXPERIMENTS; i++) {
            await d.run(sql`insert into experiments (id, project_id, user_id, name, status) values (${'exp_s_' + i}, ${starter.projectId}, ${starter.userId}, ${'S' + i}, 'running')`);
        }
        for (let i = 0; i < STARTER_RUNNING_EXPERIMENTS; i++) {
            await d.run(sql`insert into experiments (id, project_id, user_id, name, status) values (${'exp_g_' + i}, ${growth.projectId}, ${growth.userId}, ${'G' + i}, 'running')`);
        }
        const starterQ = await checkExperimentStartQuota(starter.orgId, false);
        expect(starterQ).toMatchObject({ allowed: false, reason: 'running_experiments', limit: 20, used: 20 });
        expect(quotaMessage(starterQ)).toContain('20 running tests at a time');
        expect((await checkExperimentStartQuota(growth.orgId, false)).allowed).toBe(true);
    });

    it('does not pause paid collection on a pageview default, only on an explicit cap', async () => {
        clearPageviewCache();
        const open = await getPageviewStatus(starter.orgId, { fresh: true });
        expect(open).toMatchObject({ limit: null, paused: false });
        await db.updateOrganization(starter.orgId, { monthly_pageview_limit: 1 });
        clearConfigCache();
        clearPageviewCache();
        const capped = await getPageviewStatus(starter.orgId, { fresh: true });
        expect(capped.limit).toBe(1);
        await db.updateOrganization(starter.orgId, { monthly_pageview_limit: null });
        clearConfigCache();
        clearPageviewCache();
    });
});

describe('goal cap message at the paid maximum', () => {
    it('does not tell a paid plan to upgrade for more than 50 goals', () => {
        const msg = goalPlanError({ maxGoals: PAID_MAX_GOALS, advancedGoals: true }, [{ type: 'click' }], 50);
        expect(msg).toContain('50 goals per test');
        expect(msg).not.toMatch(/upgrade/i);
    });
});
