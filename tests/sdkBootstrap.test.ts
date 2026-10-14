import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('SDK source guarantees', () => {
    const code = fs.readFileSync(path.join(__dirname, '../public/sdk.js'), 'utf8');

    it('auto-starts from data-key, uses bootstrap, sendBeacon-capable track, bot filter, flicker hide, location.replace', () => {
        expect(code).toMatch(/data-key/);
        expect(code).toMatch(/\/api\/sdk\/bootstrap/);
        expect(code).toMatch(/sendBeacon|keepalive/);
        expect(code).toMatch(/bot\|crawl\|spider/i);
        expect(code).toMatch(/abtest-wait/);
        expect(code).toMatch(/location\.replace/);
        expect(code).toMatch(/closest/);
        expect(code).toMatch(/FLICKER_MS/);
    });

    it('install snippet is a single script tag pattern', () => {
        expect(code).toMatch(/data-key/);
        expect(code).not.toMatch(/ABTest\.run\(/);
    });
});
