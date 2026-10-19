import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const read = (f: string) => fs.readFileSync(path.join(process.cwd(), f), 'utf8');

// There is no way yet to invite teammates or add projects, so public copy must not sell them as available.
describe('team seats and projects copy', () => {
    const pricing = read('app/pricing/page.tsx');
    const cards = read('app/pricing/BillingCards.tsx');
    const roadmap = read('app/roadmap/page.tsx');

    it('pricing rows say 1 today and mark more as coming soon', () => {
        const row = (name: string) => pricing.match(new RegExp(`\\['${name}', ([^\\]]+)\\]`))![1];
        for (const name of ['Projects', 'Team seats']) {
            const cells = row(name).split(/',\s*'/).map((c) => c.replace(/'/g, ''));
            expect(cells[0]).toBe('1');
            for (const c of cells.slice(1)) expect(c, `${name}: ${c}`).toMatch(/^1 today, .+ coming soon$/);
        }
    });

    it('plan cards do not list seats or projects', () => {
        expect(cards).not.toMatch(/team seats|\d+ projects|Custom projects/i);
    });

    it('coming-soon rows point at a roadmap phase that lists them', () => {
        expect(pricing).toContain("{ name: 'Invite teammates', p: 6, tier: 1 }");
        expect(roadmap).toMatch(/phase: 'Phase 6', name: 'Teams', status: '(Planned|In progress)', items: \['Invite teammates', 'More projects from the dashboard'/);
    });

    it('no custom retention or custom environments promise for Enterprise', () => {
        expect(pricing).not.toMatch(/custom retention/i);
        expect(pricing).toContain("['Environments per project', '3 (dev, staging, production)', '3', '3', '3']");
    });
});
