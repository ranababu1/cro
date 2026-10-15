import { describe, it, expect, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { NextRequest } from 'next/server';
import { unzipSync, strFromU8 } from 'fflate';

const session = vi.hoisted(() => ({ current: null as null | { user: { id: string; email: string } } }));
vi.mock('next-auth', () => ({ getServerSession: vi.fn(async () => session.current) }));
vi.mock('@/lib/telemetry', () => ({ recordProductEvent: vi.fn(async () => undefined) }));

import { GET as download } from '@/app/api/downloads/wordpress/route';

const dir = 'integrations/wordpress/freeabtest';
const read = (f: string) => fs.readFileSync(path.join(dir, f), 'utf8');
const req = () => new NextRequest('http://localhost/api/downloads/wordpress');

describe('WordPress plugin download', () => {
    it('redirects signed-out visitors to the account-holder note and serves no zip', async () => {
        session.current = null;
        const res = await download(req());
        expect(res.status).toBe(303);
        expect(res.headers.get('location')).toMatch(/\/wordpress\?download=signin#download$/);
        expect(res.headers.get('content-type') ?? '').not.toMatch(/zip/);
    });

    it('serves a zip with a freeabtest/ folder to signed-in users', async () => {
        session.current = { user: { id: 'usr_1', email: 'a@example.com' } };
        const res = await download(req());
        expect(res.status).toBe(200);
        expect(res.headers.get('content-type')).toBe('application/zip');
        expect(res.headers.get('cache-control')).toMatch(/no-store/);
        const files = unzipSync(new Uint8Array(await res.arrayBuffer()));
        expect(Object.keys(files)).toEqual(expect.arrayContaining(['freeabtest/freeabtest.php', 'freeabtest/uninstall.php', 'freeabtest/readme.txt', 'freeabtest/includes/admin.php']));
        expect(strFromU8(files['freeabtest/freeabtest.php'])).toContain('Plugin Name:       FreeABTest');
    });

    it('is not published as a static file', () => {
        const walk = (d: string): string[] => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
        expect(walk('public').filter((f) => /freeabtest.*\.(zip|php)$|\.php$/.test(f))).toEqual([]);
    });
});

describe('plugin source rules', () => {
    const php = ['freeabtest.php', 'uninstall.php', 'includes/admin.php', 'index.php', 'includes/index.php'];
    it('guards every PHP file and avoids eval or remote code', () => {
        for (const f of php) {
            const s = read(f);
            if (f === 'uninstall.php') expect(s).toContain("defined( 'WP_UNINSTALL_PLUGIN' )");
            else if (!f.endsWith('index.php')) expect(s).toContain("defined( 'ABSPATH' )");
            expect(s).not.toMatch(/\beval\s*\(|base64_decode|wp_remote_|file_get_contents\(\s*['"]http|create_function/);
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
    it('the signed-out note matches the agreed copy', () => {
        expect(fs.readFileSync('app/wordpress/page.tsx', 'utf8')).toContain('The plugin is free for freeabtest.com account holders. Create a free account to download it.');
    });
});
