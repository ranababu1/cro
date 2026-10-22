import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { sql } from 'drizzle-orm';
import { useTempDatabase } from './helpers';

const session = vi.hoisted(() => ({ current: null as null | { user: { id: string; email: string } } }));
vi.mock('next-auth', () => ({ getServerSession: vi.fn(async () => session.current) }));

import { db } from '@/lib/db';
import { getDb, resetDbForTests } from '@/lib/db/client';
import { authOptions } from '@/lib/auth';
import { runWithAuthRequest } from '@/lib/authRequest';
import { hashIp } from '@/lib/telemetry';
import { ipAndRange, reserveSignup, getSignupCaps, DEFAULT_SIGNUP_CAPS, SIGNUP_COUNT_RETENTION_DAYS, ABUSE_EVENT_RETENTION_DAYS } from '@/lib/signupLimits';
import { runRetention } from '@/lib/retention';
import { GET as getCaps, PUT as putCaps } from '@/app/api/admin/signup-limits/route';

let cleanup: () => void;
const signInCb = authOptions.callbacks!.signIn!;
const signUp = (email: string, ip: string) => runWithAuthRequest({ ip, cookies: {} }, () => signInCb({ user: { id: 'g', email, name: 'New Person' }, account: null, profile: {} as never }));
const clearCounts = async () => { const d = await getDb(); await d.run(sql`delete from signup_counts`); await d.run(sql`delete from abuse_events`); await d.run(sql`delete from platform_settings`); };
const put = (body: unknown) => putCaps(new NextRequest('http://localhost/api/admin/signup-limits', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }));

beforeAll(() => { cleanup = useTempDatabase(); process.env.PLATFORM_ADMIN_EMAILS = 'root@example.com'; });
afterAll(() => { delete process.env.PLATFORM_ADMIN_EMAILS; cleanup(); });
beforeEach(clearCounts);

describe('IP ranges', () => {
    it('groups IPv4 by /24 and IPv6 by /48, and maps IPv4-in-IPv6 to IPv4', () => {
        expect(ipAndRange('203.0.113.77')).toEqual({ ip: '203.0.113.77', range: '203.0.113.0/24' });
        expect(ipAndRange('::ffff:203.0.113.9')).toEqual({ ip: '203.0.113.9', range: '203.0.113.0/24' });
        expect(ipAndRange('::ffff:cb00:7109')).toEqual({ ip: '203.0.113.9', range: '203.0.113.0/24' });
        expect(ipAndRange('2001:db8:abcd:12::1')).toEqual({ ip: '2001:0db8:abcd:0012:0000:0000:0000:0001', range: '2001:0db8:abcd::/48' });
        expect(ipAndRange('2001:DB8:ABCD:0012:0:0:0:1')?.range).toBe('2001:0db8:abcd::/48');
        expect(ipAndRange('[fe80::1%eth0]')?.range).toBe('fe80:0000:0000::/48');
        for (const bad of ['unknown', '', '999.1.1.1', '1.2.3', '1::2::3', 'abc', null, undefined]) expect(ipAndRange(bad)).toBeNull();
    });
});

describe('daily caps stored in the database', () => {
    it('allows 3 new accounts per IP a day by default, then refuses and logs it', async () => {
        expect(await getSignupCaps()).toEqual(DEFAULT_SIGNUP_CAPS);
        for (let i = 0; i < 3; i++) expect((await reserveSignup('198.51.100.7', `a${i}@x.com`)).ok).toBe(true);
        const refused = await reserveSignup('198.51.100.7', 'a3@x.com');
        expect(refused).toMatchObject({ ok: false, reason: 'ip' });
        const log = await db.getAbuseLog();
        expect(log[0].action).toBe('abuse:signup_ip_limit');
        expect(log[0].org_id).toBeNull();
        expect(JSON.parse(log[0].diff!)).toMatchObject({ email_domain: 'x.com', cap: 3 });
        // The refused attempt did not use up a slot: the counter stays at the cap.
        expect(await db.getSignupCount('ip', hashIp('198.51.100.7')!, new Date().toISOString().slice(0, 10))).toBe(3);
    });

    it('allows 10 per /24 range a day across different IPs', async () => {
        for (let i = 1; i <= 10; i++) expect((await reserveSignup(`192.0.2.${i}`, `r${i}@x.com`)).ok).toBe(true);
        expect(await reserveSignup('192.0.2.200', 'r11@x.com')).toMatchObject({ ok: false, reason: 'range' });
        expect((await reserveSignup('192.0.3.1', 'other@x.com')).ok).toBe(true);
        expect((await db.getAbuseLog())[0].action).toBe('abuse:signup_range_limit');
    });

    it('treats a /48 IPv6 network as one range', async () => {
        for (let i = 1; i <= 10; i++) expect((await reserveSignup(`2001:db8:1:${i}::5`, `v${i}@x.com`)).ok).toBe(true);
        expect(await reserveSignup('2001:db8:1:ffff::9', 'v11@x.com')).toMatchObject({ ok: false, reason: 'range' });
        expect((await reserveSignup('2001:db8:2::1', 'v12@x.com')).ok).toBe(true);
    });

    it('resets each UTC day', async () => {
        const day1 = new Date('2026-10-22T23:59:00Z');
        for (let i = 0; i < 3; i++) await reserveSignup('198.51.100.8', `d${i}@x.com`, day1);
        expect((await reserveSignup('198.51.100.8', 'd3@x.com', day1)).ok).toBe(false);
        expect((await reserveSignup('198.51.100.8', 'd4@x.com', new Date('2026-10-23T00:01:00Z'))).ok).toBe(true);
    });

    it('is shared by every server: the counts survive a fresh connection', async () => {
        for (let i = 0; i < 3; i++) await reserveSignup('198.51.100.9', `s${i}@x.com`);
        resetDbForTests(); // like another instance opening the same database
        expect((await reserveSignup('198.51.100.9', 's3@x.com')).ok).toBe(false);
    });

    it('does not limit unknown IPs or platform admins', async () => {
        for (let i = 0; i < 5; i++) expect((await reserveSignup('unknown', `u${i}@x.com`)).ok).toBe(true);
        for (let i = 0; i < 5; i++) expect((await reserveSignup('198.51.100.10', 'root@example.com')).ok).toBe(true);
    });

    it('never stores the raw IP', async () => {
        for (let i = 0; i < 4; i++) await reserveSignup('198.51.100.11', `p${i}@x.com`);
        const d = await getDb();
        const dump = JSON.stringify([
            ...(await d.all(sql`select * from signup_counts`)),
            ...(await d.all(sql`select * from abuse_events`)),
        ]);
        expect(dump).not.toContain('198.51.100');
    });
});

describe('sign-up flow', () => {
    it('refuses the 4th new account from one IP with a friendly error and keeps existing users signing in', async () => {
        for (let i = 0; i < 3; i++) expect(await signUp(`flow${i}@x.com`, '198.51.100.20')).toBe(true);
        expect(await signUp('flow3@x.com', '198.51.100.20')).toBe('/signin?error=SignupLimit');
        expect(await db.getUserByEmail('flow3@x.com')).toBeFalsy();
        expect(await signUp('flow0@x.com', '198.51.100.20')).toBe(true);
        expect((await db.getUserByEmail('flow0@x.com'))!.signup_ip_hash).toBe(hashIp('198.51.100.20'));
    });

    it('the sign-in page explains the refusal', async () => {
        const fs = await import('node:fs');
        expect(fs.readFileSync('app/signin/page.tsx', 'utf8')).toMatch(/SignupLimit: 'We cannot create more new accounts from your network today/);
    });
});

describe('admins configure the caps', () => {
    it('is hidden from non-admins and validates input', async () => {
        const u = await db.createUser({ email: 'tenant@example.com', name: 'T' });
        session.current = { user: { id: u.id, email: u.email } };
        expect((await put({ perIp: 5, perRange: 20 })).status).toBe(404);
        expect((await getCaps()).status).toBe(404);
        const admin = await db.createUser({ email: 'root@example.com', name: 'Root' });
        session.current = { user: { id: admin.id, email: admin.email } };
        expect((await put({ perIp: 0, perRange: 20 })).status).toBe(400);
        expect((await put({ perIp: 1.5, perRange: 20 })).status).toBe(400);
    });

    it('applies new caps everywhere and logs the change', async () => {
        const admin = (await db.getUserByEmail('root@example.com'))!;
        session.current = { user: { id: admin.id, email: admin.email } };
        expect(await (await put({ perIp: 1, perRange: 2 })).json()).toEqual({ caps: { perIp: 1, perRange: 2 } });
        expect(await (await getCaps()).json()).toEqual({ caps: { perIp: 1, perRange: 2 } });
        expect((await reserveSignup('198.51.100.30', 'c1@x.com')).ok).toBe(true);
        expect((await reserveSignup('198.51.100.30', 'c2@x.com')).ok).toBe(false);
        const change = (await db.getAbuseLog()).find((e) => e.action === 'abuse:signup_limits_changed')!;
        expect(JSON.parse(change.diff!)).toEqual({ from: '3 per IP, 10 per range', to: '1 per IP, 2 per range' });
    });
});

describe('retention', () => {
    it('deletes sign-up counters after 30 days and org-less abuse events after 180 days', async () => {
        const now = new Date('2027-06-01T00:00:00Z');
        const day = (n: number) => new Date(now.getTime() - n * 86_400_000).toISOString();
        await db.bumpSignupCount('ip', 'old', day(SIGNUP_COUNT_RETENTION_DAYS + 1).slice(0, 10));
        await db.bumpSignupCount('ip', 'new', day(SIGNUP_COUNT_RETENTION_DAYS - 1).slice(0, 10));
        const d = await getDb();
        await d.run(sql`insert into abuse_events (id, kind, created_at) values ('old', 'signup_ip_limit', ${day(ABUSE_EVENT_RETENTION_DAYS + 1)}), ('new', 'signup_ip_limit', ${day(ABUSE_EVENT_RETENTION_DAYS - 1)})`);
        await d.run(sql`delete from maintenance_runs`);
        const r = await runRetention(now);
        expect(r).toMatchObject({ signupCounts: 1, abuseEvents: 1 });
        expect((await d.all<{ key_hash: string }>(sql`select key_hash from signup_counts`)).map((x) => x.key_hash)).toEqual(['new']);
        expect((await d.all<{ id: string }>(sql`select id from abuse_events`)).map((x) => x.id)).toEqual(['new']);
    });
});
