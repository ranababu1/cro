import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const src = fs.readFileSync(path.join(__dirname, '../sdk-src/sdk.js'), 'utf8');
// Pull the analytics block out of the SDK and run it against a fake window.
const block = src.slice(src.indexOf('    var analyticsOff'), src.indexOf('    function bootstrap()'));

function load(win: Record<string, unknown>, attr: string | null = null) {
    const script = { getAttribute: (n: string) => (n === 'data-analytics' ? attr : null) };
    return new Function('window', 'script', `${block}; return analyticsPush;`)(win, script) as (d: Record<string, unknown>) => void;
}
const hit = { experiment_id: 'exp_1', variation_id: 'var_b', variation_name: 'Annual first', is_control: false };

describe('GA4 push from the SDK', () => {
    it('sends a GA4 experience_impression event through gtag once per test', () => {
        const calls: unknown[][] = [];
        const push = load({ gtag: (...a: unknown[]) => calls.push(a), dataLayer: [] });
        push(hit); push(hit);
        push({ ...hit, experiment_id: 'exp_2' });
        expect(calls).toHaveLength(2);
        expect(calls[0]).toEqual(['event', 'experience_impression', { exp_variant_string: 'FABT-exp_1-var_b', experiment_id: 'exp_1', variation_id: 'var_b', variation_name: 'Annual first', is_control: false }]);
    });
    it('pushes to the GTM dataLayer when gtag is not on the page', () => {
        const dataLayer: unknown[] = [];
        load({ dataLayer })(hit);
        expect(dataLayer).toEqual([{ event: 'experience_impression', exp_variant_string: 'FABT-exp_1-var_b', experiment_id: 'exp_1', variation_id: 'var_b', variation_name: 'Annual first', is_control: false }]);
    });
    it('creates nothing without GA4 or GTM, respects data-analytics="off" and never throws', () => {
        const win: Record<string, unknown> = {};
        load(win)(hit);
        expect(win.dataLayer).toBeUndefined();
        const dataLayer: unknown[] = [];
        load({ dataLayer }, 'off')(hit);
        expect(dataLayer).toEqual([]);
        expect(() => load({ gtag: () => { throw new Error('boom'); } })(hit)).not.toThrow();
        const none: unknown[] = [];
        load({ dataLayer: none })({ experiment_id: 'exp_1' });
        expect(none).toEqual([]);
    });
    it('runs only for assigned visitors, not redirects or guards', () => {
        const at = src.indexOf('analyticsPush(data);');
        const guard = src.lastIndexOf("data.action !== 'guard'", at);
        expect(guard).toBeGreaterThan(src.indexOf("if (data.action === 'redirect'"));
        expect(at - guard).toBeLessThan(300);
    });
});
