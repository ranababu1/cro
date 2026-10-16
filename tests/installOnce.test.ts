import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { INSTALL_ONCE } from '@/lib/installCopy';
import { quickStart } from '@/lib/docs/content/quickStart';
import { installGuides } from '@/lib/docs/content/installGuides';

describe('install once copy', () => {
    it('says once per site, every future test, no head changes, with no em dashes', () => {
        expect(INSTALL_ONCE).toMatch(/once per site/);
        expect(INSTALL_ONCE).toMatch(/Every future test runs through it/);
        expect(INSTALL_ONCE).toMatch(/never need changes to your <head>/);
        expect(INSTALL_ONCE).not.toMatch(/\u2014/);
    });
    it('appears in the install docs and the setup UI', () => {
        for (const page of [quickStart, installGuides]) expect(JSON.stringify(page)).toContain('once per site');
        expect(fs.readFileSync('app/components/InstallSnippet.tsx', 'utf8')).toContain('INSTALL_ONCE');
    });
});
