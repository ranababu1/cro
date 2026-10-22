import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import { NextRequest } from 'next/server';
import { useTempDatabase } from './helpers';

const nextAuthHandler = vi.hoisted(() => vi.fn(async () => new Response('next-auth', { status: 200 })));
vi.mock('next-auth', () => ({ default: () => nextAuthHandler, getServerSession: vi.fn(async () => null) }));

import { db } from '@/lib/db';
import { authOptions } from '@/lib/auth';
import { runWithAuthRequest } from '@/lib/authRequest';
import { isValidPass, issuePass, PASS_COOKIE, PASS_TTL_SECONDS, resetTurnstileWarning, SITEVERIFY_URL, turnstileEnabled, verifyTurnstileToken } from '@/lib/turnstile';
import { POST as turnstilePost } from '@/app/api/auth/turnstile/route';
import { GET as authGet, POST as authPost } from '@/app/api/auth/[...nextauth]/route';

let cleanup: () => void;
const on = () => { process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = '0x4AAA-site'; process.env.TURNSTILE_SECRET_KEY = '0x4AAA-secret'; };
const off = () => { delete process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY; delete process.env.TURNSTILE_SECRET_KEY; };
const ctx = (...parts: string[]) => ({ params: Promise.resolve({ nextauth: parts }) });
const signInCb = authOptions.callbacks!.signIn!;
const newUser = (email: string) => signInCb({ user: { id: 'g', email, name: 'New Person' }, account: null, profile: {} as never });

beforeAll(() => { cleanup = useTempDatabase(); });
afterAll(() => { off(); cleanup(); });
afterEach(() => { off(); vi.unstubAllGlobals(); nextAuthHandler.mockClear(); });

describe('Turnstile siteverify check', () => {
    it('posts the secret, token and client IP to Cloudflare and reads success', async () => {
        on();
        const fake = vi.fn(async (_url: string, init: RequestInit) => {
            const b = init.body as URLSearchParams;
            expect(b.get('secret')).toBe('0x4AAA-secret');
            expect(b.get('response')).toBe('tok');
            expect(b.get('remoteip')).toBe('1.2.3.4');
            return Response.json({ success: true });
        });
        expect(await verifyTurnstileToken('tok', '1.2.3.4', fake as unknown as typeof fetch)).toEqual({ ok: true, codes: [] });
        expect(fake.mock.calls[0][0]).toBe(SITEVERIFY_URL);
    });

    it('fails on a rejected token, a network error and a missing secret', async () => {
        on();
        const bad = vi.fn(async () => Response.json({ success: false, 'error-codes': ['invalid-input-response'] }));
        expect(await verifyTurnstileToken('tok', null, bad as unknown as typeof fetch)).toEqual({ ok: false, codes: ['invalid-input-response'] });
        const down = vi.fn(async () => { throw new Error('down'); });
        expect((await verifyTurnstileToken('tok', null, down as unknown as typeof fetch)).ok).toBe(false);
        off();
        expect((await verifyTurnstileToken('tok', null, bad as unknown as typeof fetch)).ok).toBe(false);
    });

    it('signs a pass that expires and cannot be forged', () => {
        const now = Date.now();
        const pass = issuePass(now);
        expect(isValidPass(pass, now)).toBe(true);
        expect(isValidPass(pass, now + (PASS_TTL_SECONDS + 1) * 1000)).toBe(false);
        const [exp, nonce] = pass.split('.');
        expect(isValidPass(`${Number(exp) + 9999}.${nonce}.${pass.split('.')[2]}`, now)).toBe(false);
        expect(isValidPass('garbage', now)).toBe(false);
        expect(isValidPass(undefined, now)).toBe(false);
    });
});

describe('POST /api/auth/turnstile', () => {
    const req = (body: unknown) => new NextRequest('http://localhost/api/auth/turnstile', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '9.9.9.9' }, body: JSON.stringify(body) });

    it('skips gracefully and warns once when the keys are missing', async () => {
        resetTurnstileWarning();
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const res = await turnstilePost(req({}));
        expect(await res.json()).toEqual({ ok: true, skipped: true });
        expect(turnstileEnabled()).toBe(false);
        expect(warn).toHaveBeenCalledTimes(1);
        warn.mockRestore();
    });

    it('needs both keys: a site key alone keeps the check off', () => {
        process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = 'x';
        expect(turnstileEnabled()).toBe(false);
    });

    it('refuses a missing or failed token and sets the pass cookie on success', async () => {
        on();
        expect((await turnstilePost(req({}))).status).toBe(400);
        vi.stubGlobal('fetch', vi.fn(async () => Response.json({ success: false })));
        expect((await turnstilePost(req({ token: 'tok' }))).status).toBe(403);
        vi.stubGlobal('fetch', vi.fn(async () => Response.json({ success: true })));
        const ok = await turnstilePost(req({ token: 'tok' }));
        expect(ok.status).toBe(200);
        const cookie = ok.cookies.get(PASS_COOKIE);
        expect(isValidPass(cookie?.value)).toBe(true);
        expect(ok.headers.get('set-cookie')).toMatch(/HttpOnly/i);
        expect(ok.headers.get('set-cookie')).toMatch(/Path=\/api\/auth/);
    });
});

describe('OAuth start needs the pass', () => {
    const start = (cookie?: string, json = true) => new NextRequest('http://localhost/api/auth/signin/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', ...(cookie ? { Cookie: `${PASS_COOKIE}=${cookie}` } : {}) },
        body: new URLSearchParams({ csrfToken: 'c', callbackUrl: '/dashboard', ...(json ? { json: 'true' } : {}) }).toString(),
    });

    it('sends a bot-check error instead of starting OAuth without a pass', async () => {
        on();
        const res = await authPost(start(), ctx('signin', 'google'));
        expect(await res.json()).toEqual({ url: '/signin?error=BotCheck' });
        const form = await authPost(start(undefined, false), ctx('signin', 'google'));
        expect(form.status).toBe(303);
        expect(form.headers.get('location')).toMatch(/\/signin\?error=BotCheck$/);
        expect((await authPost(start('1.x.forged'), ctx('signin', 'google'))).headers.get('content-type')).toMatch(/json/);
        expect(nextAuthHandler).not.toHaveBeenCalled();
    });

    it('starts OAuth with a valid pass, and always when the keys are missing', async () => {
        on();
        expect(await (await authPost(start(issuePass()), ctx('signin', 'google'))).text()).toBe('next-auth');
        off();
        expect(await (await authPost(start(), ctx('signin', 'google'))).text()).toBe('next-auth');
        expect(nextAuthHandler).toHaveBeenCalledTimes(2);
    });

    it('leaves other auth routes alone', async () => {
        on();
        const signout = new NextRequest('http://localhost/api/auth/signout', { method: 'POST', body: '' });
        expect(await (await authPost(signout, ctx('signout'))).text()).toBe('next-auth');
        expect(await (await authGet(new NextRequest('http://localhost/api/auth/session'), ctx('session'))).text()).toBe('next-auth');
    });
});

describe('account creation needs the pass', () => {
    it('refuses a new account without a pass when the check is on', async () => {
        on();
        expect(await runWithAuthRequest({ ip: '1.1.1.1', cookies: {} }, () => newUser('bot@example.com'))).toBe('/signin?error=BotCheck');
        expect(await newUser('bot2@example.com')).toBe('/signin?error=BotCheck');
        expect(await db.getUserByEmail('bot@example.com')).toBeFalsy();
    });

    it('creates the account with a valid pass, or when the check is off', async () => {
        on();
        expect(await runWithAuthRequest({ ip: '1.1.1.1', cookies: { [PASS_COOKIE]: issuePass() } }, () => newUser('human@example.com'))).toBe(true);
        expect(await db.getUserByEmail('human@example.com')).toBeTruthy();
        off();
        expect(await newUser('local@example.com')).toBe(true);
    });

    it('lets an existing user sign in without a fresh pass at the callback', async () => {
        on();
        expect(await runWithAuthRequest({ ip: '1.1.1.1', cookies: {} }, () => newUser('human@example.com'))).toBe(true);
    });
});

describe('Turnstile stays out of public copy', () => {
    it('public docs and the sign-in page do not name the env vars', () => {
        const pub = [fs.readFileSync('app/signin/page.tsx', 'utf8').replace(/import[^\n]*\n/g, ''), ...fs.readdirSync('lib/docs/content').map((f) => fs.readFileSync(`lib/docs/content/${f}`, 'utf8'))].join('\n');
        expect(pub).not.toMatch(/TURNSTILE_SECRET_KEY|NEXT_PUBLIC_TURNSTILE_SITE_KEY/);
        expect(fs.readFileSync('.env.example', 'utf8')).toMatch(/NEXT_PUBLIC_TURNSTILE_SITE_KEY=\nTURNSTILE_SECRET_KEY=/);
        expect(fs.readFileSync('docs/agent.md', 'utf8')).toMatch(/TURNSTILE_SECRET_KEY/);
    });
});
