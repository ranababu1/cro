/**
 * @vitest-environment happy-dom
 * @vitest-environment-options {"settings":{"disableJavaScriptFileLoading":true,"disableCSSFileLoading":true,"handleDisabledFileLoadingAsSuccess":true}}
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

type Api = { consent: (g: boolean) => void; optOut: () => void; optIn: () => void; isOptedOut: () => boolean; getUserId: () => string; track: (n: string) => Promise<unknown>; bootstrap: () => Promise<{ reason?: string }> };
const built = fs.readFileSync(path.join(__dirname, '../public/sdk.js'), 'utf8');
const source = fs.readFileSync(path.join(__dirname, '../sdk-src/sdk.js'), 'utf8');

function installPage(consent: string | null) {
    document.open();
    document.write(`<!doctype html><html><head><script data-key="cro_pk_dev_testkey1234567890abcdefghij"${consent ? ` data-consent="${consent}"` : ''}></script></head><body></body></html>`);
    const early = document.querySelector('script');
    if (early) early.setAttribute('src', 'https://app.example.com/sdk.js');
    document.close();
    const script = document.querySelector('script');
    Object.defineProperty(document, 'currentScript', { get: () => script, configurable: true });
    Object.defineProperty(navigator, 'userAgent', { value: 'Mozilla/5.0 Chrome/120.0.0.0', configurable: true });
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ matched: false, action: 'none' }) }));
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
}
const api = () => (window as unknown as { ABTest: Api }).ABTest;
const calls = (m: ReturnType<typeof vi.fn>, part: string) => m.mock.calls.filter((c) => String(c[0]).includes(part)).length;

describe.each([['source', source], ['built', built]] as const)('SDK consent (%s)', (_l, code) => {
    beforeEach(() => {
        delete (window as unknown as { ABTest?: Api }).ABTest;
        localStorage.clear();
        sessionStorage.clear();
        document.documentElement.classList.remove('abtest-wait');
    });
    afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

    it('with data-consent="required" stores, sends and hides nothing until consent(true)', async () => {
        const fetchMock = installPage('required');
        (0, eval)(code);
        await new Promise((r) => setTimeout(r, 0));
        expect(calls(fetchMock, '/api/sdk/bootstrap')).toBe(0);
        expect(localStorage.getItem('ab_user_id')).toBeNull();
        expect(document.documentElement.classList.contains('abtest-wait')).toBe(false);
        expect(api().getUserId()).toBe('');
        await api().track('signup');
        expect(fetchMock).not.toHaveBeenCalled();

        api().consent(true);
        await new Promise((r) => setTimeout(r, 0));
        expect(calls(fetchMock, '/api/sdk/bootstrap')).toBe(1);
        expect(localStorage.getItem('ab_user_id')).toMatch(/^user_/);
        // A second consent call does not bootstrap again.
        api().consent(true);
        await new Promise((r) => setTimeout(r, 0));
        expect(calls(fetchMock, '/api/sdk/bootstrap')).toBe(1);
    });

    it('starts right away without data-consent', async () => {
        const fetchMock = installPage(null);
        (0, eval)(code);
        await new Promise((r) => setTimeout(r, 0));
        expect(calls(fetchMock, '/api/sdk/bootstrap')).toBe(1);
    });

    it('optOut forgets the id, sends nothing more and holds across page loads until optIn', async () => {
        let fetchMock = installPage(null);
        (0, eval)(code);
        await new Promise((r) => setTimeout(r, 0));
        expect(localStorage.getItem('ab_user_id')).toBeTruthy();
        api().optOut();
        expect(api().isOptedOut()).toBe(true);
        expect(localStorage.getItem('ab_user_id')).toBeNull();
        fetchMock.mockClear();
        await api().track('signup');
        expect(fetchMock).not.toHaveBeenCalled();

        // Next page load: still opted out.
        delete (window as unknown as { ABTest?: Api }).ABTest;
        fetchMock = installPage(null);
        (0, eval)(code);
        await new Promise((r) => setTimeout(r, 0));
        expect(fetchMock).not.toHaveBeenCalled();
        expect((await api().bootstrap()).reason).toBe('no_consent');

        api().optIn();
        expect(api().isOptedOut()).toBe(false);
    });
});
