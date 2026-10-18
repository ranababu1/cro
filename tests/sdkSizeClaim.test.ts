import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { gzipSync } from 'node:zlib';

// Public pages say the SDK is under 30 KB gzipped and about 100 KB raw. Keep the claim true.
describe('SDK size claim', () => {
    const sdk = fs.readFileSync('public/sdk.js');
    it('is under 30 KB gzipped with a margin for the server\'s gzip level', () => {
        expect(gzipSync(sdk, { level: 6 }).byteLength).toBeLessThan(28 * 1024);
    });
    it('is about 100 KB raw', () => {
        expect(sdk.byteLength).toBeLessThan(115 * 1024);
    });
    it('public copy uses the measured figure', () => {
        for (const f of ['app/page.tsx', 'app/pricing/page.tsx', 'lib/docs/content/sdk.ts', 'lib/docs/content/troubleshooting.ts', 'content/blog/best-free-ab-testing-tools.md']) {
            const s = fs.readFileSync(f, 'utf8');
            expect(s).not.toMatch(/1[45] KB/);
        }
    });
});
