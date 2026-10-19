import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const root = path.join(__dirname, '..');
const read = (f: string) => fs.readFileSync(path.join(root, f), 'utf8');

describe('SDK docs match the shipped SDK', () => {
    const src = read('sdk-src/sdk.js');
    const api = src.slice(src.indexOf('window.ABTest = {'), src.indexOf('};', src.indexOf('window.ABTest = {')));
    const exposed = new Set([...api.matchAll(/^\s+(\w+):/gm)].map((m) => m[1]));

    it('exposes the documented methods', () => {
        expect([...exposed].sort()).toEqual(['bootstrap', 'getUserId', 'init', 'track', 'trackConversion']);
    });

    it('every ABTest call in the docs exists', () => {
        const dir = path.join(root, 'lib/docs/content');
        const used = new Map<string, string>();
        for (const f of fs.readdirSync(dir)) {
            for (const m of fs.readFileSync(path.join(dir, f), 'utf8').matchAll(/ABTest\??\.(\w+)/g)) used.set(m[1], f);
        }
        const missing = [...used].filter(([name]) => !exposed.has(name));
        expect(missing).toEqual([]);
        expect(used.size).toBeGreaterThan(0);
    });

    it('the SDK page headings name real methods only', () => {
        const page = read('lib/docs/content/sdk.ts');
        for (const m of page.matchAll(/text: '(\w+)\(/g)) expect(exposed.has(m[1])).toBe(true);
        expect(page).not.toMatch(/getVariation|runUrlTest|autoRedirect/);
    });
});
