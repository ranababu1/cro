import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { PLAN_PROJECTS, PLAN_SEATS } from '@/lib/plans';

const read = (f: string) => fs.readFileSync(path.join(process.cwd(), f), 'utf8');

// Teams shipped: public copy states the enforced seat and project limits, with no coming-soon tags.
describe('team seats and projects copy', () => {
    const pricing = read('app/pricing/page.tsx');
    const cards = read('app/pricing/BillingCards.tsx');
    const roadmap = read('app/roadmap/page.tsx');

    it('pricing rows match the enforced limits', () => {
        expect(pricing).toContain("['Projects', '1', '3', '10', 'Custom'],");
        expect(pricing).toContain("['Team seats', '1', '5', '15', 'Unlimited'],");
        expect(PLAN_PROJECTS).toEqual([1, 3, 10, null]);
        expect(PLAN_SEATS).toEqual([1, 5, 15, null]);
        expect(pricing).not.toMatch(/coming soon'\]/);
        expect(pricing).not.toMatch(/name: 'Invite teammates', p:/);
    });

    it('plan cards list the seats and projects each plan includes', () => {
        expect(cards).toContain("'3 projects and 5 team seats'");
        expect(cards).toContain("'10 projects and 15 team seats'");
    });

    it('the Teams phase is done on the public roadmap', () => {
        expect(roadmap).toMatch(/phase: 'Phase 6', name: 'Teams', status: 'Done'/);
    });

    it('no custom retention or custom environments promise for Enterprise', () => {
        expect(pricing).not.toMatch(/custom retention/i);
        expect(pricing).toContain("['Environments per project', '3 (dev, staging, production)', '3', '3', '3']");
    });
});
