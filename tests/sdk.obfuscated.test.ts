/**
 * @vitest-environment happy-dom
 * @vitest-environment-options {"settings":{"disableJavaScriptFileLoading":true,"disableCSSFileLoading":true,"handleDisabledFileLoadingAsSuccess":true}}
 */
// The script tag gets a same-origin src so the SDK can find its own URL. File loading is off, so happy-dom never
// tries to fetch it from localhost:3000 (that stray request used to crash the test worker now and then).
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

declare global {
    interface Window {
        ABTest?: {
            init: (options: { apiUrl?: string; apiKey?: string; userId?: string }) => void;
            bootstrap: () => Promise<{ matched?: boolean; action?: string; variation_id?: string; experiment_id?: string }>;
            getUserId: () => string;
            trackConversion: (experimentId: string, eventName?: string) => Promise<unknown>;
        };
    }
}


const built = fs.readFileSync(path.join(__dirname, '../public/sdk.js'), 'utf8');
const source = fs.readFileSync(path.join(__dirname, '../sdk-src/sdk.js'), 'utf8');

function installPage(opts: { redirect?: boolean; bot?: boolean } = {}) {
    document.open();
    document.write(`<!doctype html><html><head>
      <script data-key="cro_pk_dev_testkey1234567890abcdefghij"></script>
    </head><body><button id="headerCTA">Go</button><a class="footer-signup" href="#">x</a></body></html>`);
    // Give the tag a same-origin src without triggering happy-dom network fetch of the file.
    const early = document.querySelector('script');
    if (early) early.setAttribute('src', '/sdk.js');
    document.close();
    const script = document.querySelector('script');
    Object.defineProperty(document, 'currentScript', { get: () => script, configurable: true });
    if (opts.bot) {
        Object.defineProperty(navigator, 'userAgent', { value: 'Googlebot/2.1', configurable: true });
    } else {
        Object.defineProperty(navigator, 'userAgent', {
            value: 'Mozilla/5.0 (Macintosh; Intel Mac OS X) Chrome/120.0.0.0',
            configurable: true,
        });
    }
    let replaced: string | null = null;
    (window.location as Location & { replace: (u: string) => void }).replace = (u: string) => { replaced = String(u); };
    vi.stubGlobal('fetch', vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({
            matched: true,
            action: opts.redirect ? 'redirect' : 'expose',
            experiment_id: 'exp_1',
            variation_id: 'var_1',
            variation_url: opts.redirect ? 'http://localhost:3000/v1?x=1' : undefined,
            goals: [
                { id: 'gol_1', name: 'CTA', selector: '#headerCTA', is_primary: true },
                { id: 'gol_2', name: 'Footer', selector: '.footer-signup', is_primary: false },
            ],
        }),
    })));
    return {
        get replaced() { return replaced; },
        fetchMock: fetch as unknown as ReturnType<typeof vi.fn>,
    };
}

function load(code: string) {
    (0, eval)(code);
}

describe.each([
    ['source', source],
    ['built', built],
] as const)('SDK behavior (%s)', (_label, code) => {
    beforeEach(() => {
        // reset ABTest
        delete window.ABTest;
        vi.unstubAllGlobals();
        document.documentElement.classList.remove('abtest-wait');
    });
    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it('exposes ABTest and sticky user id', async () => {
        const page = installPage();
        load(code);
        expect(window.ABTest).toBeTruthy();
        window.ABTest!.init({ apiUrl: 'https://example.com', apiKey: 'cro_pk_dev_testkey1234567890abcdefghij', userId: 'u_fixed' });
        expect(window.ABTest!.getUserId()).toBe('u_fixed');
        const data = await window.ABTest!.bootstrap();
        expect(data.matched).toBe(true);
        expect(page.fetchMock).toHaveBeenCalled();
        const bootCall = page.fetchMock.mock.calls.find((c) => String(c[0]).includes('/api/sdk/bootstrap'));
        expect(bootCall).toBeTruthy();
    });

    it('hides for flicker control then reveals on expose', async () => {
        installPage();
        load(code);
        window.ABTest!.init({ apiUrl: 'https://example.com', apiKey: 'cro_pk_dev_testkey1234567890abcdefghij', userId: 'u1' });
        const p = window.ABTest!.bootstrap();
        expect(document.documentElement.classList.contains('abtest-wait')).toBe(true);
        await p;
        expect(document.documentElement.classList.contains('abtest-wait')).toBe(false);
    });

    it('redirects with location.replace and keeps query', async () => {
        window.history.replaceState({}, '', '/page?utm=1#hash');
        const page = installPage({ redirect: true });
        load(code);
        // Force apiUrl so bootstrap talks to our stub; variation_url is absolute in the stub.
        window.ABTest!.init({ apiUrl: 'https://example.com', apiKey: 'cro_pk_dev_testkey1234567890abcdefghij', userId: 'u2' });
        await window.ABTest!.bootstrap();
        expect(page.replaced).toBeTruthy();
        expect(String(page.replaced)).toContain('/v1');
        expect(String(page.replaced)).toContain('utm=1');
    });

    it('fires click goals once per goal', async () => {
        const page = installPage();
        load(code);
        window.ABTest!.init({ apiUrl: 'https://example.com', apiKey: 'cro_pk_dev_testkey1234567890abcdefghij', userId: 'u3' });
        await window.ABTest!.bootstrap();
        const btn = document.getElementById('headerCTA')!;
        btn.click();
        btn.click();
        await new Promise((r) => setTimeout(r, 20));
        const trackCalls = page.fetchMock.mock.calls.filter((c) => String(c[0]).includes('/api/track'));
        const conversions = trackCalls.flatMap((c) => {
            const body = JSON.parse(String(c[1]?.body || '{}'));
            return (body.events || [body]) as Array<{ event_type: string; goal_id?: string }>;
        }).filter((e) => e.event_type === 'conversion' && e.goal_id === 'gol_1');
        expect(conversions.length).toBe(1);
    });
});

describe('built SDK bot filter', () => {
    it('does not expose ABTest for bots', () => {
        delete window.ABTest;
        installPage({ bot: true });
        load(built);
        expect(window.ABTest).toBeUndefined();
    });
});

// silence unused
export {};
