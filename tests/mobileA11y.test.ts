import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const read = (f: string) => fs.readFileSync(path.join(process.cwd(), f), 'utf8');

describe('mobile layout and accessibility guards', () => {
    it('table scroll areas contain their absolutely positioned labels and take keyboard focus', () => {
        // sr-only header text is position:absolute; without a positioned wrapper it widened the whole page on phones.
        expect(read('app/components/ui/Table.tsx')).toContain('<div className="relative overflow-x-auto" tabIndex={0}>');
        expect(read('app/components/ui/CodeBlock.tsx')).toContain('<pre tabIndex={0}');
    });

    it('two-column app grids collapse to one shrinkable column on phones', () => {
        for (const f of ['app/(app)/surveys/page.tsx', 'app/(app)/popups/page.tsx', 'app/(app)/traffic/page.tsx', 'app/(app)/settings/domains/page.tsx', 'app/(app)/experiments/[id]/HeatmapsPanel.tsx']) {
            expect(read(f), f).not.toMatch(/className="grid gap-\d lg:grid-cols-2"/);
        }
    });

    it('the theme switch leaves the narrow top bar and sits in the phone menu', () => {
        const shell = read('app/components/shell/AppShell.tsx');
        expect(shell).toContain('<div className="hidden sm:block"><ThemeToggle /></div>');
        expect(shell).toMatch(/sm:hidden"><ThemeToggle \/><\/div>/);
    });

    it('grey text tokens meet 4.5:1 on white', () => {
        const css = read('app/globals.css');
        expect(css).toContain('--color-zinc-400: #71717b;');
        expect(css).toContain('--color-zinc-500: #6b6b75;');
    });

    it('progress bars are named and the trend switch is a group of toggle buttons', () => {
        expect(read('app/components/PageviewUsage.tsx')).toContain('aria-label="Page views used this month"');
        const t = read('app/(app)/experiments/[id]/FunnelTrend.tsx');
        expect(t).toContain('role="group" aria-label="Trend period"');
        expect(t).toContain('aria-pressed={trend.bucket === b}');
    });
});
