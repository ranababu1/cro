import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { useTempDatabase } from './helpers';
import { db } from '@/lib/db';
import { generateId } from '@/lib/ids';

let cleanup: () => void;
beforeAll(() => { cleanup = useTempDatabase(); });
afterAll(() => cleanup());

describe('database layer', () => {
    it('persists users and creates a workspace once', async () => {
        const user = await db.createUser({ email: 'a@example.com', name: 'Alice' });
        expect(await db.getUserByEmail('a@example.com')).toMatchObject({ id: user.id, name: 'Alice' });

        const ws1 = await db.ensureWorkspace(user);
        const ws2 = await db.ensureWorkspace(user);
        expect(ws2).toEqual(ws1);

        const envs = await db.getEnvironments(ws1.projectId);
        expect(envs.map((e) => e.key).sort()).toEqual(['dev', 'prod', 'staging']);
        const log = await db.getAuditLog(ws1.orgId);
        expect(log.some((l) => l.entity === 'organization' && l.action === 'create')).toBe(true);
    });

    it('rejects duplicate emails', async () => {
        await expect(db.createUser({ email: 'a@example.com', name: 'Again' })).rejects.toThrow();
    });

    it('authenticates active keys and rejects revoked ones', async () => {
        const user = await db.createUser({ email: 'k@example.com', name: 'Key' });
        const ws = await db.ensureWorkspace(user);
        const prod = (await db.getEnvironments(ws.projectId)).find((e) => e.key === 'prod')!;
        const created = await db.createApiKey({ environmentId: prod.id, type: 'sdk', createdBy: user.id });

        const ctx = await db.authenticateApiKey(created.key);
        expect(ctx).toMatchObject({ environmentId: prod.id, environmentKey: 'prod', projectId: ws.projectId, orgId: ws.orgId, type: 'sdk' });
        expect((await db.listApiKeys(ws.projectId))[0].last_used_at).not.toBeNull();

        await db.revokeApiKey(created.id);
        expect(await db.authenticateApiKey(created.key)).toBeNull();
        expect(await db.authenticateApiKey('cro_pk_prod_' + 'x'.repeat(32))).toBeNull();
    });

    it('stores experiments, keeps one assignment per visitor, and counts converting users', async () => {
        const user = await db.createUser({ email: 'e@example.com', name: 'Exp' });
        const ws = await db.ensureWorkspace(user);
        const id = generateId('exp');
        await db.createExperiment(
            { id, project_id: ws.projectId, user_id: user.id, name: 'Test', status: 'draft', traffic_allocation: 100 },
            [{ name: 'Control', weight: 50, is_control: true }, { name: 'B', weight: 50, is_control: false }],
        );
        expect((await db.getExperiments([ws.projectId])).map((e) => e.id)).toContain(id);
        expect(await db.getExperiments(['prj_other'])).toEqual([]);

        const [control, b] = await db.getVariations(id);
        await db.createAssignment({ experiment_id: id, variation_id: control.id, user_id: 'v1' });
        await db.createAssignment({ experiment_id: id, variation_id: b.id, user_id: 'v1' });
        expect((await db.getAssignment(id, 'v1'))?.variation_id).toBe(control.id);

        for (const [uid, type] of [['v1', 'page_view'], ['v1', 'conversion'], ['v1', 'conversion'], ['v2', 'page_view']] as const) {
            await db.createEvent({ experiment_id: id, variation_id: control.id, environment_id: null, user_id: uid, event_type: type, event_name: null, goal_id: null, metadata: null });
        }
        const stats = await db.getEventStats(id);
        expect(stats).toHaveLength(1);
        expect(Number(stats[0].total_users)).toBe(2);
        // Two conversion events from one visitor count once.
        expect(Number(stats[0].conversions)).toBe(1);

        await db.deleteExperiment(id);
        expect(await db.getExperiment(id)).toBeNull();
        expect(await db.getVariations(id)).toEqual([]);
    });
});
