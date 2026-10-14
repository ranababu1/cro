import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { useTempDatabase } from './helpers';

const session = vi.hoisted(() => ({ current: null as null | { user: { id: string; email: string } } }));
vi.mock('next-auth', () => ({ getServerSession: vi.fn(async () => session.current) }));

import { db } from '@/lib/db';
import { GET as install } from '@/app/api/install/route';
import { publicAppOrigin, installSnippetHtml } from '@/lib/publicOrigin';

let cleanup: () => void;
let userId: string;
let projectId: string;

beforeAll(async () => {
    cleanup = useTempDatabase();
    process.env.NEXT_PUBLIC_APP_ORIGIN = 'https://www.freeabtest.com';
    const u = await db.createUser({ email: 'install@example.com', name: 'Install' });
    const ws = await db.ensureWorkspace(u);
    userId = u.id;
    projectId = ws.projectId;
    session.current = { user: { id: userId, email: u.email } };
});
afterAll(() => {
    delete process.env.NEXT_PUBLIC_APP_ORIGIN;
    cleanup();
});

describe('public origin + snippet html', () => {
    it('defaults to www.freeabtest.com and fills the key', () => {
        expect(publicAppOrigin()).toBe('https://www.freeabtest.com');
        expect(installSnippetHtml('https://www.freeabtest.com', 'cro_pk_prod_abc')).toContain('data-key="cro_pk_prod_abc"');
        expect(installSnippetHtml('https://www.freeabtest.com', 'cro_pk_prod_abc')).not.toContain('YOUR_SDK_KEY');
    });
});

describe('auto SDK keys + /api/install', () => {
    it('creates retrievable prod and dev SDK keys on workspace create', async () => {
        const keys = await db.listApiKeys(projectId);
        const sdk = keys.filter((k) => k.type === 'sdk' && !k.revoked_at);
        expect(sdk.some((k) => k.environment_key === 'prod' && k.key_plaintext?.startsWith('cro_pk_prod_'))).toBe(true);
        expect(sdk.some((k) => k.environment_key === 'dev' && k.key_plaintext?.startsWith('cro_pk_dev_'))).toBe(true);
        // secret keys stay hash-only
        const secret = await db.createApiKey({
            environmentId: (await db.getEnvironments(projectId)).find((e) => e.key === 'prod')!.id,
            type: 'secret',
        });
        const listed = await db.listApiKeys(projectId);
        const row = listed.find((k) => k.id === secret.id);
        expect(row?.key_plaintext).toBeNull();
    });

    it('returns pre-filled install payload for the signed-in user', async () => {
        const res = await install(new NextRequest('http://localhost/api/install'));
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.origin).toBe('https://www.freeabtest.com');
        expect(body.keys.prod).toMatch(/^cro_pk_prod_/);
        expect(body.keys.dev).toMatch(/^cro_pk_dev_/);
        expect(body.default_env).toBe('prod');
    });

    it('lazily creates keys for projects that are missing them', async () => {
        // Simulate a project with environments but no SDK keys
        const u = await db.createUser({ email: 'lazy@example.com', name: 'Lazy' });
        const ws = await db.ensureWorkspace(u);
        // revoke all sdk keys
        const keys = await db.listApiKeys(ws.projectId);
        for (const k of keys.filter((x) => x.type === 'sdk')) await db.revokeApiKey(k.id);
        const afterRevoke = await db.getInstallSdkKeys(ws.projectId, u.id);
        expect(afterRevoke.prod).toMatch(/^cro_pk_prod_/);
        expect(afterRevoke.dev).toMatch(/^cro_pk_dev_/);
    });
});
