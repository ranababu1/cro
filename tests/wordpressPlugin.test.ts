import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { NextRequest } from 'next/server';
import { unzipSync, strFromU8 } from 'fflate';
import { useTempDatabase, seedProjectDomain } from './helpers';

const session = vi.hoisted(() => ({ current: null as null | { user: { id: string; email: string } } }));
vi.mock('next-auth', () => ({ getServerSession: vi.fn(async () => session.current) }));

import { db } from '@/lib/db';
import { clearConfigCache } from '@/lib/configCache';
import { GET as download } from '@/app/api/downloads/wordpress/route';
import { POST as verify } from '@/app/api/plugin/verify/route';
import { POST as bootstrap } from '@/app/api/sdk/bootstrap/route';
import { POST as track } from '@/app/api/track/route';
import { PLUGIN_DOWNLOAD_LIMITS } from '@/lib/pluginDownload';

const dir = 'integrations/wordpress/freeabtest';
const read = (f: string) => fs.readFileSync(path.join(dir, f), 'utf8');
const req = () => new NextRequest('http://localhost/api/downloads/wordpress');

type Tenant = { userId: string; email: string; orgId: string; projectId: string; prodKey: string; devKey: string };
const t: Record<string, Tenant> = {};
let cleanup: () => void;

async function tenant(email: string, plan: string, host = 'shop.example.com'): Promise<Tenant> {
    const u = await db.createUser({ email, name: email });
    const ws = await db.ensureWorkspace(u);
    await db.updateOrganization(ws.orgId, { plan });
    await seedProjectDomain(ws.projectId, host);
    const envs = await db.getEnvironments(ws.projectId);
    const prodKey = (await db.createApiKey({ environmentId: envs.find((e) => e.key === 'prod')!.id, type: 'sdk' })).key;
    const devKey = (await db.createApiKey({ environmentId: envs.find((e) => e.key === 'dev')!.id, type: 'sdk' })).key;
    return { userId: u.id, email, orgId: ws.orgId, projectId: ws.projectId, prodKey, devKey };
}

beforeAll(async () => {
    cleanup = useTempDatabase();
    process.env.PLATFORM_ADMIN_EMAILS = 'ops@example.com';
    t.free = await tenant('free@example.com', 'free', 'free-site.example.com');
    t.paid = await tenant('paid@example.com', 'starter');
    t.friend = await tenant('friend@example.com', 'free', 'friend.example.com');
    await db.updateOrganization(t.friend.orgId, { special_friend: true, custom_allowances: JSON.stringify({ wordpress_plugin: true }) });
    t.ops = await tenant('ops@example.com', 'free', 'ops.example.com');
    clearConfigCache();
});
afterAll(() => { delete process.env.PLATFORM_ADMIN_EMAILS; cleanup(); });

const as = (x: Tenant | null) => { session.current = x ? { user: { id: x.userId, email: x.email } } : null; };

describe('WordPress plugin download (paid only)', () => {
    it('redirects signed-out visitors to the sign-up form and serves no zip', async () => {
        as(null);
        const res = await download(req());
        expect(res.status).toBe(303);
        expect(res.headers.get('location')).toMatch(/\/wordpress\?download=signin#download$/);
        expect(res.headers.get('content-type') ?? '').not.toMatch(/zip/);
    });

    it('sends free users to the upgrade prompt and serves no zip', async () => {
        as(t.free);
        const res = await download(req());
        expect(res.status).toBe(303);
        expect(res.headers.get('location')).toMatch(/\/wordpress\?download=upgrade#download$/);
        expect(res.headers.get('content-type') ?? '').not.toMatch(/zip/);
    });

    it('serves a watermarked zip to paid users and logs the download', async () => {
        as(t.paid);
        const res = await download(req());
        expect(res.status).toBe(200);
        expect(res.headers.get('content-type')).toBe('application/zip');
        expect(res.headers.get('cache-control')).toMatch(/no-store/);
        const files = unzipSync(new Uint8Array(await res.arrayBuffer()));
        expect(Object.keys(files)).toEqual(expect.arrayContaining(['freeabtest/freeabtest.php', 'freeabtest/uninstall.php', 'freeabtest/readme.txt', 'freeabtest/includes/admin.php', 'freeabtest/license.txt']));
        expect(strFromU8(files['freeabtest/freeabtest.php'])).toContain('Plugin Name:       FreeABTest');
        const log = await db.listPluginDownloads();
        expect(log[0]).toMatchObject({ org_id: t.paid.orgId, user_email: 'paid@example.com', plugin: 'wordpress' });
        expect(strFromU8(files['freeabtest/license.txt'])).toContain(t.paid.orgId);
        expect(strFromU8(files['freeabtest/license.txt'])).toContain(log[0].id);
    });

    it('allows special friends with the grant and platform admins', async () => {
        as(t.friend);
        expect((await download(req())).status).toBe(200);
        as(t.ops);
        expect((await download(req())).status).toBe(200);
    });

    it('rate limits downloads per user', async () => {
        as(t.paid);
        const already = (await db.countPluginDownloads(t.paid.userId, t.paid.orgId, new Date(Date.now() - 3_600_000).toISOString())).user;
        for (let i = already; i < PLUGIN_DOWNLOAD_LIMITS.userPerHour; i++) expect((await download(req())).status).toBe(200);
        const res = await download(req());
        expect(res.status).toBe(303);
        expect(res.headers.get('location')).toMatch(/download=limit/);
    });

    it('is not published as a static file', () => {
        const walk = (d: string): string[] => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
        expect(walk('public').filter((f) => /freeabtest.*\.(zip|php)$|\.php$|\.zip$/.test(f))).toEqual([]);
    });
});

describe('a shared plugin zip is useless', () => {
    const check = async (key: string, site: string) => (await (await verify(new NextRequest('http://localhost/api/plugin/verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key, site_url: site }) }))).json()).status;

    it('connect check: paid key on its own domain is ok', async () => {
        expect(await check(t.paid.prodKey, 'https://shop.example.com/')).toBe('ok');
        expect(await check(t.paid.devKey, 'http://localhost:8080/')).toBe('ok');
    });
    it('connect check: refuses a shared key on the wrong domain, an unpaid org and bad keys', async () => {
        expect(await check(t.paid.prodKey, 'https://someone-else.example.org/')).toBe('domain_not_allowed');
        expect(await check(t.free.prodKey, 'https://free-site.example.com/')).toBe('not_paid');
        expect(await check('cro_pk_prod_' + 'x'.repeat(32), 'https://shop.example.com/')).toBe('invalid_key');
        expect(await check('cro_sk_prod_' + 'x'.repeat(32), 'https://shop.example.com/')).toBe('invalid_key');
        expect(await check(t.friend.prodKey, 'https://friend.example.com/')).toBe('ok');
    });

    const sdk = (fn: typeof bootstrap, p: string, key: string, origin: string, body: unknown) => fn(new NextRequest(`http://localhost${p}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'X-API-Key': key, origin }, body: JSON.stringify(body),
    }));

    it('SDK calls tagged as plugin traffic need a paid org', async () => {
        const free = await (await sdk(bootstrap, '/api/sdk/bootstrap?via=wp', t.free.prodKey, 'https://free-site.example.com', { url: 'https://free-site.example.com/', user_id: 'v1' })).json();
        expect(free).toMatchObject({ matched: false, action: 'none', reason: 'plan_required' });
        const freeTrack = await sdk(track, '/api/track?via=wp', t.free.prodKey, 'https://free-site.example.com', { events: [] });
        expect(freeTrack.status).toBe(403);
        // The plain snippet keeps working for free users.
        const plain = await (await sdk(bootstrap, '/api/sdk/bootstrap', t.free.prodKey, 'https://free-site.example.com', { url: 'https://free-site.example.com/', user_id: 'v1' })).json();
        expect(plain.reason).not.toBe('plan_required');
        const paid = await (await sdk(bootstrap, '/api/sdk/bootstrap?via=wp', t.paid.prodKey, 'https://shop.example.com', { url: 'https://shop.example.com/', user_id: 'v1' })).json();
        expect(paid.reason).toBe('no_match');
    });

    it('SDK calls with a shared paid key from another domain get nothing', async () => {
        const r = await (await sdk(bootstrap, '/api/sdk/bootstrap?via=wp', t.paid.prodKey, 'https://someone-else.example.org', { url: 'https://someone-else.example.org/', user_id: 'v1' })).json();
        expect(r).toMatchObject({ matched: false, action: 'none', reason: 'domain_not_allowed' });
    });

    it('stops working when the org is no longer paid', async () => {
        await db.updateOrganization(t.paid.orgId, { plan: 'free' });
        clearConfigCache();
        expect(await check(t.paid.prodKey, 'https://shop.example.com/')).toBe('not_paid');
        const r = await (await sdk(bootstrap, '/api/sdk/bootstrap?via=wp', t.paid.prodKey, 'https://shop.example.com', { url: 'https://shop.example.com/', user_id: 'v1' })).json();
        expect(r.reason).toBe('plan_required');
        await db.updateOrganization(t.paid.orgId, { plan: 'starter' });
        clearConfigCache();
    });
});

describe('plugin source rules', () => {
    const php = ['freeabtest.php', 'uninstall.php', 'includes/admin.php', 'index.php', 'includes/index.php'];
    it('guards every PHP file and avoids eval or remote code', () => {
        for (const f of php) {
            const s = read(f);
            if (f === 'uninstall.php') expect(s).toContain("defined( 'WP_UNINSTALL_PLUGIN' )");
            else if (!f.endsWith('index.php')) expect(s).toContain("defined( 'ABSPATH' )");
            expect(s).not.toMatch(/\beval\s*\(|base64_decode|wp_remote_get|file_get_contents\(\s*['"]http|create_function/);
        }
    });
    it('hardcodes the SDK URL, validates keys strictly and checks capabilities', () => {
        const main = read('freeabtest.php');
        const admin = read('includes/admin.php');
        expect(main).toContain("'https://www.freeabtest.com/sdk.js'");
        expect(main).toContain("'/^cro_pk_' . $environment . '_[0-9A-Za-z]{32}$/'");
        expect(main).toContain("add_action( 'wp_head', 'freeabtest_print_snippet', 1 )");
        expect(main).toContain("'async'    => true");
        expect(admin).toContain("'manage_options'");
        expect(admin).toContain("settings_fields( 'freeabtest' )");
        expect(read('readme.txt')).toMatch(/License: GPLv2 or later[\s\S]*== External services ==/);
    });
    it('has no em dashes in user-facing text', () => {
        for (const f of [...php, 'readme.txt']) expect(read(f)).not.toMatch(/\u2014/);
        expect(fs.readFileSync('app/wordpress/page.tsx', 'utf8')).not.toMatch(/\u2014/);
    });
    it('the download page says the plugin is for paid users only', () => {
        const page = fs.readFileSync('app/wordpress/page.tsx', 'utf8');
        expect(page).toContain('The WordPress plugin is available to paid users only. Create an account and choose a paid plan to download it.');
        expect(page).toContain('The WordPress plugin is available to paid users only. Upgrade to Starter or above');
    });
    it('only prints the snippet after the server confirmed the key, tags plugin traffic and talks only to freeabtest.com', () => {
        const main = read('freeabtest.php');
        expect(main).toMatch(/if \( '' === \$key \|\| ! freeabtest_is_connected\( \$settings \) \)/);
        expect(main).toContain("'data-via' => 'wp'");
        expect(main).toContain("FREEABTEST_APP_URL . '/api/plugin/verify'");
        expect((main.match(/wp_remote_post\(/g) ?? []).length).toBe(1);
        expect(read('includes/admin.php')).toContain('The WordPress plugin is available to paid users only.');
        expect(read('readme.txt')).toContain('https://www.freeabtest.com/api/plugin/verify');
    });
});

describe('SDK tags plugin traffic', () => {
    it('copies data-via="wp" to every API call, including beacons and heatmap capture', () => {
        const src = fs.readFileSync('sdk-src/sdk.js', 'utf8');
        expect(src).toContain("getAttribute('data-via')) === 'wp'");
        expect(src).toContain('config.apiUrl + withVia(path)');
        expect(src).toContain("withVia('/api/track?key='");
        expect(fs.readFileSync('public/heatmap.js', 'utf8')).toContain("(cfg.via === 'wp' ? '&via=wp' : '')");
    });
});

describe('migration 0017_plugin_downloads', () => {
    it('is newer than every earlier migration', () => {
        const journal = JSON.parse(fs.readFileSync('drizzle/meta/_journal.json', 'utf8')).entries as { tag: string; when: number }[];
        const i = journal.findIndex((e) => e.tag === '0017_plugin_downloads');
        expect(i).toBeGreaterThan(0);
        expect(journal.slice(0, i).every((e) => e.when < journal[i].when)).toBe(true);
    });
});
