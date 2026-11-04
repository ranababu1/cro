import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { NextRequest } from 'next/server';
import { useTempDatabase, seedProjectDomain, makePaid } from './helpers';

vi.mock('next-auth', () => ({ getServerSession: vi.fn(async () => null) }));

import { db } from '@/lib/db';
import { generateId } from '@/lib/ids';
import { getDb, resetDbForTests } from '@/lib/db/client';
import { isPrivateAddress, webhookUrlError, checkHost } from '@/lib/webhooks';
import { pageUrlError } from '@/lib/ai/pageText';
import { createExperimentSchema, assignSchema } from '@/lib/validation';
import { normalizePageUrl } from '@/lib/domains';
import { RateLimiter } from '@/lib/rateLimit';
import { cached, clearConfigCache, configCacheSize } from '@/lib/configCache';
import { authenticateSdkRequest } from '@/lib/requestAuth';
import { POST as track } from '@/app/api/track/route';

describe('internal addresses written as IPv6', () => {
    // The URL parser turns [::ffff:127.0.0.1] into [::ffff:7f00:1], so the dotted form is never what arrives.
    const internal = [
        '::ffff:7f00:1', '::ffff:127.0.0.1', '::ffff:a9fe:a9fe', '::ffff:a00:1', '::ffff:c0a8:1',
        '::7f00:1', '::127.0.0.1', '64:ff9b::7f00:1', '64:ff9b::a9fe:a9fe', '2002:7f00:1::', '2002:a9fe:a9fe::1',
        'fec0::1', '2001:db8::1', '100::1', '0:0:0:0:0:0:0:1', '::', '::1', 'fe80::1', 'fd00::1', 'ff02::1',
    ];
    const publicV6 = ['2606:4700::1111', '2001:4860:4860::8888', '::ffff:808:808', '::ffff:8.8.8.8', '64:ff9b::808:808', '2002:808:808::1'];

    it('treats them as private', () => {
        for (const ip of internal) expect(isPrivateAddress(ip), ip).toBe(true);
    });
    it('keeps public addresses usable', () => {
        for (const ip of publicV6) expect(isPrivateAddress(ip), ip).toBe(false);
    });
    it('refuses them in webhook and page reader URLs', async () => {
        for (const ip of ['::ffff:7f00:1', '::ffff:a9fe:a9fe', '64:ff9b::7f00:1', '2002:7f00:1::', '::7f00:1', 'fec0::1']) {
            expect(webhookUrlError(`https://[${ip}]/hook`), ip).not.toBeNull();
            expect(pageUrlError(`http://[${ip}]/latest/meta-data/`), ip).not.toBeNull();
            expect('error' in (await checkHost(`https://[${ip}]/x`, async () => [])), ip).toBe(true);
        }
        expect(webhookUrlError('https://[2606:4700::1111]/hook')).toBeNull();
    });
    it('refuses a host name that resolves to one', async () => {
        const r = await checkHost('https://tricky.example.com/x', async () => ['::ffff:7f00:1']);
        expect('error' in r).toBe(true);
    });
});

describe('page and variation addresses must be http or https', () => {
    const bad = ['javascript:alert(1)', 'javascript://javascript/%0Aalert(document.domain)', 'data:text/html,<script>1</script>', 'vbscript:x', 'ftp://example.com/a', 'file:///etc/passwd'];
    const variations = (url: string) => [
        { name: 'Control', url: 'https://example.com/a', weight: 50, is_control: true },
        { name: 'B', url, weight: 50, is_control: false },
    ];
    const body = (control_url: string, url: string) => ({ name: 'T', control_url, variations: variations(url), goals: [{ name: 'g', selector: '#a', is_primary: true }] });

    it('createExperimentSchema refuses other schemes in the control and variation URLs', () => {
        for (const u of bad) {
            expect(createExperimentSchema.safeParse(body(u, 'https://example.com/b')).success, `control ${u}`).toBe(false);
            expect(createExperimentSchema.safeParse(body('https://example.com/a', u)).success, `variation ${u}`).toBe(false);
        }
        expect(createExperimentSchema.safeParse(body('https://example.com/a', 'http://example.com/b')).success).toBe(true);
    });
    it('assignSchema refuses them too', () => {
        for (const u of bad) expect(assignSchema.safeParse({ url: u, user_id: 'v1' }).success, u).toBe(false);
    });
    it('normalizePageUrl gives nothing for them', () => {
        for (const u of bad) expect(normalizePageUrl(u), u).toBeNull();
        expect(normalizePageUrl('https://example.com/a/?x=1#y')).toBe('https://example.com/a');
    });
});

describe('browser SDK', () => {
    const src = fs.readFileSync(path.join(__dirname, '../sdk-src/sdk.js'), 'utf8');
    const idBlock = src.slice(src.indexOf('    var memoryId'), src.indexOf('    // New vs returning'));
    const redirectBlock = src.slice(src.indexOf('    function redirectTo'), src.indexOf('    // Heatmap capture is a separate module'));

    function loadId(env: { localStorage?: unknown; document?: unknown }) {
        const config = { userId: null as string | null };
        const fn = new Function('config', 'localStorage', 'document', `${idBlock}; return getUserId;`);
        return fn(config, env.localStorage, env.document) as () => string;
    }
    const blockedStorage = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };

    it('keeps one visitor id for the whole page when storage is blocked', () => {
        const getUserId = loadId({ localStorage: blockedStorage, document: { cookie: '' } });
        const first = getUserId();
        expect(first).toMatch(/^user_/);
        expect(getUserId()).toBe(first);
        expect(getUserId()).toBe(first);
    });
    it('falls back to a first-party cookie, and reads it back on the next page', () => {
        const jar: Record<string, string> = {};
        const doc = {
            get cookie() { return Object.entries(jar).map(([k, v]) => `${k}=${v}`).join('; '); },
            set cookie(v: string) { const [kv] = v.split(';'); const [k, val] = kv.split('='); jar[k.trim()] = val; },
        };
        const id = loadId({ localStorage: blockedStorage, document: doc })();
        expect(jar.ab_user_id).toBe(id);
        expect(loadId({ localStorage: blockedStorage, document: doc })()).toBe(id);
    });
    it('does not write a cookie when local storage works', () => {
        const store: Record<string, string> = {};
        const ls = { getItem: (k: string) => store[k] ?? null, setItem: (k: string, v: string) => { store[k] = v; } };
        let written = '';
        const doc = { get cookie() { return written; }, set cookie(v: string) { written = v; } };
        const id = loadId({ localStorage: ls, document: doc })();
        expect(store.ab_user_id).toBe(id);
        expect(written).toBe('');
    });

    function runRedirect(target: string) {
        const calls: string[] = [];
        const win = { location: { href: 'https://example.com/a', pathname: '/a', origin: 'https://example.com', replace: (u: string) => calls.push(u) } };
        let revealed = 0;
        const fn = new Function('window', 'reveal', 'URL', `${redirectBlock}; return redirectTo;`);
        fn(win, () => { revealed++; }, URL)(target);
        return { calls, revealed };
    }
    it('never navigates to anything but http or https', () => {
        for (const u of ['javascript:alert(1)', 'javascript://example.com/%0Aalert(1)', 'data:text/html,x']) {
            const r = runRedirect(u);
            expect(r.calls, u).toEqual([]);
            expect(r.revealed, u).toBe(1);
        }
        expect(runRedirect('https://example.com/b').calls).toEqual(['https://example.com/b']);
    });
});

describe('memory caps', () => {
    it('RateLimiter forgets the oldest keys beyond its cap', () => {
        const t = 0;
        const rl = new RateLimiter(5, 60_000, () => t, 100);
        for (let i = 0; i < 500; i++) rl.check(`k${i}`);
        expect(rl.size).toBeLessThanOrEqual(100);
        // The newest key is still tracked, so it is counted rather than reset.
        for (let i = 0; i < 5; i++) rl.check('k499');
        expect(rl.check('k499').allowed).toBe(false);
    });
    it('RateLimiter.exceeded looks without counting', () => {
        const rl = new RateLimiter(2, 60_000);
        expect(rl.exceeded('a')).toBe(false);
        rl.check('a'); rl.check('a');
        expect(rl.exceeded('a')).toBe(false);
        rl.check('a');
        expect(rl.exceeded('a')).toBe(true);
        expect(rl.exceeded('b')).toBe(false);
    });
    it('the config cache stays bounded however many different keys are asked for', async () => {
        clearConfigCache();
        for (let i = 0; i < 12_000; i++) await cached(`probe:${i}`, async () => i, 600_000);
        expect(configCacheSize()).toBeLessThanOrEqual(10_000);
        // Recent entries survive the eviction.
        let loads = 0;
        await cached('probe:11999', async () => { loads++; return 1; }, 600_000);
        expect(loads).toBe(0);
        clearConfigCache();
    });
    it('expired config entries are dropped instead of piling up', async () => {
        vi.useFakeTimers();
        try {
            clearConfigCache();
            await cached('first', async () => 1, 120_000);
            for (let i = 0; i < 300; i++) await cached(`old:${i}`, async () => i, 1_000);
            expect(configCacheSize()).toBe(301);
            vi.setSystemTime(Date.now() + 61_000);
            await cached('trigger', async () => 1, 60_000);
            // The expired ones are gone; the entry that is still fresh stays.
            expect(configCacheSize()).toBe(2);
        } finally {
            vi.useRealTimers();
            clearConfigCache();
        }
    });
});

describe('unknown SDK keys cannot be used to hammer the database', () => {
    let cleanup: () => void;
    beforeAll(() => { cleanup = useTempDatabase(); });
    afterAll(() => cleanup());
    const ask = (key: string, ip: string) => new NextRequest('http://localhost/api/assign', { method: 'POST', headers: { 'x-forwarded-for': ip, 'X-API-Key': key } });

    it('answers 429 to an address that keeps sending unknown keys, without looking them up', async () => {
        const spy = vi.spyOn(db, 'authenticateApiKey');
        const results: number[] = [];
        for (let i = 0; i < 80; i++) {
            const r = await authenticateSdkRequest(ask('cro_pk_dev_' + String(i).padStart(32, 'X'), '9.9.9.9'));
            results.push('error' in r ? r.error.status : 200);
        }
        expect(results.slice(0, 5).every((s) => s === 401)).toBe(true);
        expect(results.at(-1)).toBe(429);
        expect(spy.mock.calls.length).toBeLessThan(80);
        // Another address is not affected.
        const other = await authenticateSdkRequest(ask('cro_pk_dev_' + 'Q'.repeat(32), '8.8.4.4'));
        expect('error' in other && other.error.status).toBe(401);
        spy.mockRestore();
    });
});

describe('database connection', () => {
    it('tries again after a failed start instead of failing until the process restarts', async () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cro-retry-'));
        process.env.DATABASE_URL = `file:${path.join(dir, 'retry.db')}`;
        process.env.DB_AUTO_MIGRATE = 'true';
        resetDbForTests();
        const cwd = vi.spyOn(process, 'cwd').mockReturnValue(fs.mkdtempSync(path.join(os.tmpdir(), 'cro-empty-')));
        await expect(getDb()).rejects.toThrow();
        cwd.mockRestore();
        const d = await getDb();
        expect(d).toBeTruthy();
        resetDbForTests();
        fs.rmSync(dir, { recursive: true, force: true });
    });
});

describe('POST /api/track keeps each visitor in one version', () => {
    let cleanup: () => void;
    let key: string;
    let expId: string;
    let varA: string;
    let varB: string;
    const post = (body: unknown) => track(new NextRequest('http://localhost/api/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '2.2.2.2', Origin: 'http://localhost', 'X-API-Key': key },
        body: JSON.stringify(body),
    }));

    beforeAll(async () => {
        cleanup = useTempDatabase();
        const u = await db.createUser({ email: 'ga@example.com', name: 'Ga' });
        const ws = await db.ensureWorkspace(u);
        await makePaid(ws.orgId);
        await seedProjectDomain(ws.projectId, 'localhost');
        const env = (await db.getEnvironments(ws.projectId)).find((e) => e.key === 'dev')!;
        key = (await db.createApiKey({ environmentId: env.id, type: 'sdk' })).key;
        expId = generateId('exp');
        await db.createExperiment(
            { id: expId, project_id: ws.projectId, user_id: u.id, name: 'E', status: 'running', traffic_allocation: 100 },
            [{ name: 'Control', weight: 50, is_control: true }, { name: 'B', weight: 50, is_control: false }],
        );
        const vs = await db.getVariations(expId);
        varA = vs[0].id;
        varB = vs[1].id;
        await db.createAssignment({ experiment_id: expId, variation_id: varA, user_id: 'stuck' });
    });
    afterAll(() => cleanup());

    it('refuses an event for a different version than the one the visitor was given', async () => {
        const res = await post({ experiment_id: expId, variation_id: varB, user_id: 'stuck', event_type: 'page_view' });
        expect(res.status).toBe(409);
        expect((await res.json()).variation_id).toBe(varA);
        const conv = await post({ experiment_id: expId, variation_id: varB, user_id: 'stuck', event_type: 'conversion', event_name: 'x' });
        expect(conv.status).toBe(409);
    });
    it('records events for the assigned version, and in a batch drops only the mismatched ones', async () => {
        expect((await post({ experiment_id: expId, variation_id: varA, user_id: 'stuck', event_type: 'page_view' })).status).toBe(201);
        const res = await post({ events: [
            { experiment_id: expId, variation_id: varA, user_id: 'stuck', event_type: 'page_view' },
            { experiment_id: expId, variation_id: varB, user_id: 'stuck', event_type: 'page_view' },
        ] });
        const body = await res.json();
        expect(body.accepted).toBe(1);
        expect(body.results.map((r: { status: number }) => r.status)).toEqual([201, 409]);
    });
    it('still accepts events from visitors with no stored assignment', async () => {
        expect((await post({ experiment_id: expId, variation_id: varB, user_id: 'fresh', event_type: 'page_view' })).status).toBe(201);
    });
});
