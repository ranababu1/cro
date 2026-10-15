import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

// Links from the signed-in app to the docs or the public site open in a new tab, so work is not lost.
const roots = ['app/(app)', 'app/admin', 'app/onboarding', 'app/components/shell', 'app/components/profile', 'app/components/PlanUsage.tsx', 'app/components/UpgradeNote.tsx', 'app/components/WordPressCard.tsx', 'app/components/InstallSnippet.tsx'];
const files = (p: string): string[] => fs.statSync(p).isDirectory() ? fs.readdirSync(p).flatMap((f) => files(path.join(p, f))) : p.endsWith('.tsx') ? [p] : [];
const PUBLIC = /href=(["'`{])\/?(\/?)(docs|pricing|roadmap|blog|wordpress)\b|href="https:\/\/www\.freeabtest\.com/;

describe('in-app links to docs and the public site', () => {
    it('use target=_blank with rel=noopener noreferrer', () => {
        const bad: string[] = [];
        for (const f of roots.flatMap(files)) {
            fs.readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
                if (/href=["'{`]+\/(docs|pricing|roadmap|blog|wordpress)/.test(line) || PUBLIC.test(line)) {
                    if (!line.includes('target="_blank"') || !line.includes('rel="noopener noreferrer"')) bad.push(`${f}:${i + 1}`);
                }
            });
        }
        expect(bad).toEqual([]);
    });
});
