import fs from 'node:fs';
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { useTempDatabase } from './helpers';

const session = vi.hoisted(() => ({ current: null as null | { user: { id: string } } }));
vi.mock('next-auth', () => ({ getServerSession: vi.fn(async () => session.current) }));

import { db } from '@/lib/db';
import { clearConfigCache } from '@/lib/configCache';
import { computeEntitlements, getOrgEntitlements } from '@/lib/entitlements';
import { getPlanUsage } from '@/lib/planUsage';
import { GET as getBilling } from '@/app/api/billing/route';

const NOW = Date.parse('2026-12-01T00:00:00Z');
const future = '2026-12-20T00:00:00.000Z';
const past = '2026-11-20T00:00:00.000Z';

describe('an assigned plan and a paid subscription', () => {
    it('a paid Growth subscription lifts an assigned Starter plan, so Starter users can buy Growth', () => {
        const e = computeEntitlements({ plan: 'growth', plan_override: 'starter' }, [], NOW);
        expect(e.plan).toBe('growth');
        expect(e.planSource).toBe('billing');
        expect(e.limits.monthlyVisitors).toBe(1_000_000);
    });

    it('keeps an assigned plan when it is as high as billing, and never lifts Free or Enterprise assignments', () => {
        expect(computeEntitlements({ plan: 'starter', plan_override: 'starter' }, [], NOW)).toMatchObject({ plan: 'starter', planSource: 'assigned' });
        expect(computeEntitlements({ plan: 'free', plan_override: 'starter' }, [], NOW)).toMatchObject({ plan: 'starter', planSource: 'assigned' });
        expect(computeEntitlements({ plan: 'growth', plan_override: 'free' }, [], NOW)).toMatchObject({ plan: 'free', planSource: 'assigned' });
        expect(computeEntitlements({ plan: 'growth', plan_override: 'enterprise' }, [], NOW)).toMatchObject({ plan: 'enterprise', planSource: 'assigned' });
        expect(computeEntitlements({ plan: 'starter', plan_override: 'growth' }, [], NOW)).toMatchObject({ plan: 'growth', planSource: 'assigned' });
    });

    it('stops lifting when the Growth subscription has ended or a downgrade is due', () => {
        expect(computeEntitlements({ plan: 'growth', plan_override: 'starter', plan_ends_at: past }, [], NOW)).toMatchObject({ plan: 'starter', planSource: 'assigned' });
        expect(computeEntitlements({ plan: 'growth', plan_override: 'starter', plan_ends_at: future }, [], NOW).plan).toBe('growth');
        expect(computeEntitlements({ plan: 'growth', plan_override: 'starter', scheduled_plan: 'starter', scheduled_plan_at: past }, [], NOW)).toMatchObject({ plan: 'starter', planSource: 'assigned' });
    });
});

describe('plan and billing for signed-in users', () => {
    let cleanup: () => void;
    let ownerId: string, memberId: string, orgId: string;
    beforeAll(async () => {
        cleanup = useTempDatabase();
        const owner = await db.createUser({ email: 'plan-owner@example.com', name: 'Owner' });
        ownerId = owner.id;
        orgId = (await db.ensureWorkspace(owner)).orgId;
        const member = await db.createUser({ email: 'plan-member@example.com', name: 'Member' });
        memberId = member.id;
        await db.addMember(orgId, memberId, 'member');
    });
    beforeEach(() => { clearConfigCache(); session.current = { user: { id: ownerId } }; });
    afterAll(() => cleanup());

    const get = () => getBilling(new NextRequest('http://localhost/api/billing', { headers: { Origin: 'http://localhost' } }));

    it('shows the plan even while paid checkout is off, and nothing about payments to members', async () => {
        await db.updateOrganization(orgId, { plan_override: 'starter' });
        clearConfigCache();
        expect(await (await get()).json()).toEqual({ enabled: false, owner: true, plan: 'starter', plan_source: 'assigned' });
        session.current = { user: { id: memberId } };
        expect(await (await get()).json()).toEqual({ enabled: false, owner: false, plan: 'starter' });
        expect((await getOrgEntitlements(orgId)).plan).toBe('starter');
    });

    it('lists usage against the limits of the effective plan', async () => {
        const u = await getPlanUsage(orgId);
        expect(u.plan).toBe('starter');
        const visitors = u.rows.find((r) => r.label === 'Tested visitors this month')!;
        expect(visitors.limit).toBe(250_000);
        expect(visitors.used).toBe(0);
        expect(u.rows.find((r) => r.label === 'Projects')!.limit).toBe(3);
    });
});

describe('plan and billing wiring', () => {
    const read = (f: string) => fs.readFileSync(f, 'utf8');

    it('the signed-in header shows a plan badge and the nav always has Plan and billing', () => {
        const shell = read('app/components/shell/AppShell.tsx');
        expect(shell).toContain('data-testid="plan-badge"');
        expect(shell).toContain('href="/settings/billing"');
        expect(shell).toContain("item('/settings/billing', 'Plan and billing'");
        expect(read('app/(app)/layout.tsx')).toContain('plan={plan}');
    });

    it('Overview links to Plan and billing, and limit alerts point there instead of the public pricing page', () => {
        const usage = read('app/components/PlanUsage.tsx');
        expect(usage).toContain('data-testid="manage-plan"');
        expect(usage).toContain('href="/settings/billing"');
        expect(usage).not.toContain('href="/pricing"');
        expect(read('app/(app)/dashboard/page.tsx')).toContain('getPlanUsage');
    });

    it('the billing page is never a 404 and explains the upgrade rules in plain words', () => {
        const client = read('app/(app)/settings/billing/BillingClient.tsx');
        expect(client).toContain('Plan and billing');
        expect(client).toContain('data-testid="billing-unavailable"');
        expect(client).toContain('data-testid="billing-interval"');
        expect(client).toContain('charged in full today');
        expect(client).toContain('not refunded');
        expect(client).not.toMatch(/\u2014|\u2013/);
    });

    it('pricing buttons for Starter and Growth carry the chosen plan and period into Plan and billing', () => {
        const cards = read('app/pricing/BillingCards.tsx');
        expect(cards).toContain('/settings/billing?plan=');
        expect(cards).toContain("t.name === 'Starter' || t.name === 'Growth'");
    });
});
