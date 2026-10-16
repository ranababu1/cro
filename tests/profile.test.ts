import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { NextRequest } from 'next/server';
import fs from 'node:fs';
import { useTempDatabase, seedProjectDomain, flowExperimentBody } from './helpers';

const session = vi.hoisted(() => ({ current: null as null | { user: { id: string; email: string } } }));
vi.mock('next-auth', () => ({ getServerSession: vi.fn(async () => session.current) }));

import { db } from '@/lib/db';
import { profileSchema, safeNext, csvCell, isProfileComplete, splitName, PROFILE_REQUIRED_MESSAGE } from '@/lib/profile';
import { authOptions } from '@/lib/auth';
import { PUT as putProfile, GET as getProfile } from '@/app/api/profile/route';
import { POST as dismiss } from '@/app/api/profile/dismiss/route';
import { POST as skip } from '@/app/api/profile/skip/route';
import { GET as exportProfiles } from '@/app/api/admin/profiles/route';
import { POST as createExperiment } from '@/app/api/experiments/route';
import { PATCH as patchExperiment } from '@/app/api/experiments/[id]/route';

let cleanup: () => void;
const json = (method: string, url: string, body?: unknown, headers: Record<string, string> = {}) => new NextRequest(`http://localhost${url}`, {
    method, headers: { 'Content-Type': 'application/json', ...headers }, body: body === undefined ? undefined : JSON.stringify(body),
});
const p = (id: string) => ({ params: Promise.resolve({ id }) });
const valid = { first_name: 'Ada', last_name: 'Lovelace', country: 'GB', phone: '+44 20 7946 0958', company: 'example.com', job_role: 'Marketing', company_size: '2-10', heard_from: 'Search engine', primary_goal: 'Increase conversions', marketing_opt_in: false };
type U = { id: string; email: string; projectId: string; orgId: string };
const u: Record<string, U> = {};
async function user(key: string, email: string, complete: boolean) {
    const x = await db.createUser({ email, name: 'Ada Lovelace', ...(complete ? {} : { first_name: null }) });
    const ws = await db.ensureWorkspace(x);
    await seedProjectDomain(ws.projectId, 'localhost');
    u[key] = { id: x.id, email, projectId: ws.projectId, orgId: ws.orgId };
}
const create = (who: U) => { session.current = { user: { id: who.id, email: who.email } }; return createExperiment(json('POST', '/api/experiments', flowExperimentBody())); };

beforeAll(async () => {
    cleanup = useTempDatabase();
    process.env.PLATFORM_ADMIN_EMAILS = 'root@example.com';
    await user('fresh', 'fresh@example.com', false);
    await user('admin', 'root@example.com', false);
    await user('done', 'done@example.com', true);
});
afterAll(() => { delete process.env.PLATFORM_ADMIN_EMAILS; cleanup(); });

describe('profile validation', () => {
    it('requires first name, last name and country, and stores phone as E.164', () => {
        const ok = profileSchema.parse(valid);
        expect(ok.phone).toBe('+442079460958');
        expect(ok.marketing_opt_in).toBe(false);
        for (const k of ['first_name', 'last_name', 'country'] as const) expect(profileSchema.safeParse({ ...valid, [k]: '' }).success).toBe(false);
        expect(profileSchema.safeParse({ ...valid, country: 'XX' }).success).toBe(false);
        expect(profileSchema.safeParse({ ...valid, phone: '12' }).success).toBe(false);
        expect(profileSchema.parse({ ...valid, phone: '' }).phone).toBeNull();
        expect(profileSchema.parse({ ...valid, phone: '020 7946 0958' }).phone).toBe('+442079460958');
    });

    it('rejects unknown select values and defaults marketing opt-in to off', () => {
        expect(profileSchema.safeParse({ ...valid, job_role: 'Hacker' }).success).toBe(false);
        expect(profileSchema.safeParse({ ...valid, company_size: '9000' }).success).toBe(false);
        const rest: Partial<typeof valid> = { ...valid };
        delete rest.marketing_opt_in;
        expect(profileSchema.parse(rest).marketing_opt_in).toBe(false);
        expect(profileSchema.parse({ ...valid, job_role: '' }).job_role).toBeNull();
    });

    it('strips markup and control characters (XSS safety)', () => {
        const r = profileSchema.parse({ ...valid, first_name: '<script>alert(1)</script>Ada', company: 'Acme <img src=x onerror=alert(1)>\u0000' });
        expect(r.first_name).not.toMatch(/[<>]/);
        expect(r.company).not.toMatch(/[<>\u0000]/);
        expect(profileSchema.safeParse({ ...valid, first_name: '<>' }).success).toBe(false);
        expect(profileSchema.safeParse({ ...valid, first_name: 'x'.repeat(61) }).success).toBe(false);
    });

    it('only allows same-site return paths, splits names and neutralises CSV formulas', () => {
        expect(safeNext('/experiments/new')).toBe('/experiments/new');
        for (const bad of ['https://evil.com', '//evil.com', '/\\evil.com', '', null]) expect(safeNext(bad)).toBe('/dashboard');
        expect(splitName('Ada King Lovelace')).toEqual({ first: 'Ada', last: 'King Lovelace' });
        expect(csvCell('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
        expect(csvCell(null)).toBe('""');
        expect(csvCell('+442079460958')).toBe('"+442079460958"');
        expect(csvCell('+SUM(1)')).toBe(`"'+SUM(1)"`);
    });
});

describe('sign-up prefill and onboarding flags', () => {
    it('new Google sign-ups get first and last name prefilled and onboarding pending', async () => {
        const signIn = authOptions.callbacks!.signIn!;
        await signIn({ user: { id: 'g', email: 'new@example.com', name: 'Grace Hopper' }, account: null, profile: { given_name: 'Grace', family_name: 'Hopper' } as never });
        const created = (await db.getUserByEmail('new@example.com'))!;
        expect(created.first_name).toBe('Grace');
        expect(created.last_name).toBe('Hopper');
        expect(created.onboarding_pending).toBe(true);
        expect(created.marketing_opt_in).toBe(false);
        expect(isProfileComplete(created)).toBe(false);
    });

    it('skip clears the onboarding step and dismiss hides the prompt, without completing the profile', async () => {
        const g = (await db.getUserByEmail('new@example.com'))!;
        session.current = { user: { id: g.id, email: g.email } };
        expect((await skip(json('POST', '/api/profile/skip'))).status).toBe(200);
        expect((await dismiss(json('POST', '/api/profile/dismiss'))).status).toBe(200);
        const after = (await db.getUser(g.id))!;
        expect(after.onboarding_pending).toBe(false);
        expect(after.profile_prompt_dismissed_at).toBeTruthy();
        expect(isProfileComplete(after)).toBe(false);
    });
});

describe('profile gate on create and start', () => {
    it('blocks creating experiments until the profile is complete', async () => {
        const res = await create(u.fresh);
        expect(res.status).toBe(403);
        const body = await res.json();
        expect(body.error).toBe(PROFILE_REQUIRED_MESSAGE);
        expect(body.reason).toBe('profile_incomplete');
        expect(await db.getExperiments([u.fresh.projectId])).toHaveLength(0);
    });

    it('blocks starting an existing draft until the profile is complete, then allows it', async () => {
        const id = 'exp_gate_draft';
        await db.createExperiment({ id, project_id: u.fresh.projectId, user_id: u.fresh.id, name: 'Old draft', status: 'draft', traffic_allocation: 100, control_url: 'http://localhost/a' },
            [{ name: 'Control', weight: 50, is_control: true, url: 'http://localhost/a' }, { name: 'B', weight: 50, is_control: false, url: 'http://localhost/b' }]);
        session.current = { user: { id: u.fresh.id, email: u.fresh.email } };
        const blocked = await patchExperiment(json('PATCH', `/api/experiments/${id}`, { status: 'running' }), p(id));
        expect(blocked.status).toBe(403);
        expect((await db.getExperiment(id))?.status).toBe('draft');

        expect((await putProfile(json('PUT', '/api/profile', { ...valid, first_name: ' Ada ' }))).status).toBe(200);
        const me = await (await getProfile(json('GET', '/api/profile'))).json();
        expect(me.complete).toBe(true);
        expect(me.profile.first_name).toBe('Ada');
        expect((await patchExperiment(json('PATCH', `/api/experiments/${id}`, { status: 'running' }), p(id))).status).toBe(200);
        expect((await create(u.fresh)).status).toBe(201);
    });

    it('rejects an invalid profile save and keeps the gate closed', async () => {
        session.current = { user: { id: u.admin.id, email: u.admin.email } };
        expect((await putProfile(json('PUT', '/api/profile', { ...valid, country: '' }))).status).toBe(400);
    });

    it('platform admins are exempt', async () => {
        expect(isProfileComplete(await db.getUser(u.admin.id))).toBe(false);
        expect((await create(u.admin)).status).toBe(201);
    });

    it('signed-out requests are refused', async () => {
        session.current = null;
        expect((await putProfile(json('PUT', '/api/profile', valid))).status).toBe(401);
    });
});

describe('admin profile export', () => {
    it('is admin only and returns CSV with profile fields', async () => {
        session.current = { user: { id: u.done.id, email: u.done.email } };
        expect((await exportProfiles()).status).toBe(404);
        session.current = { user: { id: u.admin.id, email: u.admin.email } };
        const res = await exportProfiles();
        expect(res.status).toBe(200);
        expect(res.headers.get('content-type')).toMatch(/text\/csv/);
        const text = await res.text();
        expect(text.split('\r\n')[0]).toMatch(/^user_id,email,first_name,last_name,country,phone/);
        expect(text).toContain('"fresh@example.com","Ada","Lovelace","GB","+442079460958"');
    });
});

describe('migration', () => {
    it('0014 adds the profile columns with a journal entry newer than every earlier one', () => {
        const sqlText = fs.readFileSync('drizzle/0014_user_profile.sql', 'utf8');
        for (const c of ['first_name', 'last_name', 'country', 'phone', 'marketing_opt_in', 'onboarding_pending']) expect(sqlText).toContain(`\`${c}\``);
        const j = JSON.parse(fs.readFileSync('drizzle/meta/_journal.json', 'utf8')).entries as { tag: string; when: number }[];
        const i = j.findIndex((e) => e.tag === '0014_user_profile');
        expect(i).toBeGreaterThan(0);
        expect(j[i].when).toBeGreaterThan(Math.max(...j.slice(0, i).map((e) => e.when)));
    });
});
