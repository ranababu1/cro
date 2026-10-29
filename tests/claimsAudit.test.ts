import { describe, it, expect } from 'vitest';
import fs from 'node:fs';

// Public copy must never show a planned feature as available.
const pricing = fs.readFileSync('app/pricing/page.tsx', 'utf8');
const comingSoon = [...pricing.matchAll(/\{ name: '([^']+)', tier: \d \}/g)].map((m) => m[1]);

describe('claims audit', () => {
    it('session recordings are listed as coming soon, not available today', () => {
        const today = pricing.slice(pricing.indexOf('const availableToday'), pricing.indexOf('const comingSoon'));
        expect(today).not.toMatch(/recording/i);
        expect(pricing.slice(pricing.indexOf('const comingSoon'))).toMatch(/\{ name: 'Session recordings', tier: 1 \}/);
    });
    it('coming soon tags carry no phase number', () => {
        expect(comingSoon.length).toBeGreaterThan(0);
        expect(pricing).toContain('Coming soon</span>');
        expect(pricing).not.toMatch(/Phase/);
    });
});
