import { and, eq, inArray, isNull, desc, asc, sql } from 'drizzle-orm';
import { getDb } from './client';
import * as s from './schema';
import type { EnvironmentKey } from './schema';
import { generateId } from '../ids';
import { generateApiKey, hashApiKey, type ApiKeyType } from '../apiKeys';
import type { Experiment, Variation, Assignment, Event, User } from '../types';

export { getDb } from './client';

const nowIso = () => new Date().toISOString();

function slugify(input: string): string {
    const base = input.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'org';
    return `${base}-${generateId().slice(0, 6)}`;
}

export interface Workspace {
    orgId: string;
    projectId: string;
}

export interface SdkKeyContext {
    keyId: string;
    environmentId: string;
    environmentKey: EnvironmentKey;
    projectId: string;
    orgId: string;
    type: ApiKeyType;
}

export const db = {
    // Users and tenancy
    async getUserByEmail(email: string): Promise<User | null> {
        const d = await getDb();
        return (await d.query.users.findFirst({ where: eq(s.users.email, email) })) ?? null;
    },

    async createUser(data: { email: string; name: string; image?: string | null }): Promise<User> {
        const d = await getDb();
        const id = generateId('usr');
        await d.insert(s.users).values({ id, email: data.email, name: data.name, image: data.image ?? null });
        return (await d.query.users.findFirst({ where: eq(s.users.id, id) }))!;
    },

    /**
     * Makes sure the user belongs to at least one org with a project and the three environments.
     * Called on sign-in. Returns the user's first org and project.
     */
    async ensureWorkspace(user: User): Promise<Workspace> {
        const d = await getDb();
        const existing = await d
            .select({ orgId: s.projects.org_id, projectId: s.projects.id })
            .from(s.memberships)
            .innerJoin(s.projects, eq(s.projects.org_id, s.memberships.org_id))
            .where(eq(s.memberships.user_id, user.id))
            .orderBy(asc(s.projects.created_at))
            .limit(1);
        if (existing[0]) return existing[0];

        const orgId = generateId('org');
        const projectId = generateId('prj');
        const orgName = `${user.name || user.email.split('@')[0]}'s organization`;
        await d.batch([
            d.insert(s.organizations).values({ id: orgId, name: orgName, slug: slugify(orgName) }),
            d.insert(s.memberships).values({ org_id: orgId, user_id: user.id, role: 'owner' }),
            d.insert(s.projects).values({ id: projectId, org_id: orgId, name: 'Default project' }),
            d.insert(s.environments).values(
                s.ENVIRONMENT_KEYS.map((key) => ({
                    id: generateId('env'),
                    project_id: projectId,
                    key,
                    name: { dev: 'Development', staging: 'Staging', prod: 'Production' }[key],
                })),
            ),
        ]);
        await this.audit({ orgId, actorId: user.id, entity: 'organization', entityId: orgId, action: 'create' });
        return { orgId, projectId };
    },

    async getProjectsForUser(userId: string) {
        const d = await getDb();
        return d
            .select({ id: s.projects.id, org_id: s.projects.org_id, name: s.projects.name })
            .from(s.memberships)
            .innerJoin(s.projects, eq(s.projects.org_id, s.memberships.org_id))
            .where(eq(s.memberships.user_id, userId))
            .orderBy(asc(s.projects.created_at));
    },

    async getProject(projectId: string) {
        const d = await getDb();
        return (await d.query.projects.findFirst({ where: eq(s.projects.id, projectId) })) ?? null;
    },

    async getEnvironments(projectId: string) {
        const d = await getDb();
        return d.query.environments.findMany({ where: eq(s.environments.project_id, projectId) });
    },

    async getEnvironment(environmentId: string) {
        const d = await getDb();
        return (await d.query.environments.findFirst({ where: eq(s.environments.id, environmentId) })) ?? null;
    },

    // API keys
    async createApiKey(input: { environmentId: string; type: ApiKeyType; label?: string; createdBy?: string }) {
        const d = await getDb();
        const env = await this.getEnvironment(input.environmentId);
        if (!env) throw new Error('Environment not found');
        const { key, hash, prefix } = generateApiKey(input.type, env.key);
        const id = generateId('key');
        await d.insert(s.apiKeys).values({
            id,
            environment_id: env.id,
            type: input.type,
            key_hash: hash,
            prefix,
            label: input.label ?? null,
            created_by: input.createdBy ?? null,
        });
        return { id, key, prefix, type: input.type, environment_id: env.id };
    },

    async listApiKeys(projectId: string) {
        const d = await getDb();
        return d
            .select({
                id: s.apiKeys.id,
                environment_id: s.apiKeys.environment_id,
                environment_key: s.environments.key,
                type: s.apiKeys.type,
                prefix: s.apiKeys.prefix,
                label: s.apiKeys.label,
                created_at: s.apiKeys.created_at,
                last_used_at: s.apiKeys.last_used_at,
                revoked_at: s.apiKeys.revoked_at,
            })
            .from(s.apiKeys)
            .innerJoin(s.environments, eq(s.environments.id, s.apiKeys.environment_id))
            .where(eq(s.environments.project_id, projectId))
            .orderBy(desc(s.apiKeys.created_at));
    },

    async getApiKeyProject(keyId: string): Promise<string | null> {
        const d = await getDb();
        const rows = await d
            .select({ projectId: s.environments.project_id })
            .from(s.apiKeys)
            .innerJoin(s.environments, eq(s.environments.id, s.apiKeys.environment_id))
            .where(eq(s.apiKeys.id, keyId));
        return rows[0]?.projectId ?? null;
    },

    async revokeApiKey(keyId: string): Promise<void> {
        const d = await getDb();
        await d.update(s.apiKeys).set({ revoked_at: nowIso() }).where(and(eq(s.apiKeys.id, keyId), isNull(s.apiKeys.revoked_at)));
    },

    /** Looks up an active key by its plaintext value. Returns null for unknown or revoked keys. */
    async authenticateApiKey(plaintext: string): Promise<SdkKeyContext | null> {
        const d = await getDb();
        const rows = await d
            .select({
                keyId: s.apiKeys.id,
                type: s.apiKeys.type,
                revokedAt: s.apiKeys.revoked_at,
                lastUsedAt: s.apiKeys.last_used_at,
                environmentId: s.environments.id,
                environmentKey: s.environments.key,
                projectId: s.projects.id,
                orgId: s.projects.org_id,
            })
            .from(s.apiKeys)
            .innerJoin(s.environments, eq(s.environments.id, s.apiKeys.environment_id))
            .innerJoin(s.projects, eq(s.projects.id, s.environments.project_id))
            .where(eq(s.apiKeys.key_hash, hashApiKey(plaintext)))
            .limit(1);
        const row = rows[0];
        if (!row || row.revokedAt) return null;
        // Write last_used_at at most once a minute per key to keep hot paths cheap.
        if (!row.lastUsedAt || Date.now() - Date.parse(row.lastUsedAt) > 60_000) {
            await d.update(s.apiKeys).set({ last_used_at: nowIso() }).where(eq(s.apiKeys.id, row.keyId));
        }
        return {
            keyId: row.keyId,
            type: row.type,
            environmentId: row.environmentId,
            environmentKey: row.environmentKey,
            projectId: row.projectId,
            orgId: row.orgId,
        };
    },

    // Experiments
    async getExperiments(projectIds: string[]): Promise<Experiment[]> {
        if (projectIds.length === 0) return [];
        const d = await getDb();
        return d.select().from(s.experiments).where(inArray(s.experiments.project_id, projectIds)).orderBy(desc(s.experiments.created_at));
    },

    async getExperiment(id: string): Promise<Experiment | null> {
        const d = await getDb();
        return (await d.query.experiments.findFirst({ where: eq(s.experiments.id, id) })) ?? null;
    },

    async createExperiment(
        experiment: Pick<Experiment, 'id' | 'project_id' | 'user_id' | 'name' | 'status' | 'traffic_allocation'> & { description?: string | null },
        variations: Array<Pick<Variation, 'name' | 'weight' | 'is_control'> & { description?: string | null; url?: string | null }>,
    ): Promise<void> {
        const d = await getDb();
        await d.batch([
            d.insert(s.experiments).values({ ...experiment, description: experiment.description ?? null }),
            d.insert(s.variations).values(
                variations.map((v) => ({
                    id: generateId('var'),
                    experiment_id: experiment.id,
                    name: v.name,
                    description: v.description ?? null,
                    url: v.url ?? null,
                    weight: v.weight,
                    is_control: v.is_control,
                })),
            ),
        ]);
    },

    async updateExperiment(
        id: string,
        updates: Partial<Pick<Experiment, 'name' | 'description' | 'status' | 'traffic_allocation' | 'started_at' | 'ended_at'>>,
    ): Promise<void> {
        const d = await getDb();
        await d.update(s.experiments).set({ ...updates, updated_at: nowIso() }).where(eq(s.experiments.id, id));
    },

    async deleteExperiment(id: string): Promise<void> {
        const d = await getDb();
        await d.delete(s.experiments).where(eq(s.experiments.id, id));
    },

    // Variations
    async getVariations(experimentId: string): Promise<Variation[]> {
        const d = await getDb();
        return d.select().from(s.variations).where(eq(s.variations.experiment_id, experimentId)).orderBy(asc(s.variations.created_at), asc(s.variations.id));
    },

    // Assignments
    async getAssignment(experimentId: string, userId: string): Promise<Assignment | null> {
        const d = await getDb();
        return (
            (await d.query.assignments.findFirst({
                where: and(eq(s.assignments.experiment_id, experimentId), eq(s.assignments.user_id, userId)),
            })) ?? null
        );
    },

    async createAssignment(a: { experiment_id: string; variation_id: string; user_id: string; environment_id?: string | null }): Promise<void> {
        const d = await getDb();
        await d
            .insert(s.assignments)
            .values({ id: generateId('asn'), ...a, environment_id: a.environment_id ?? null })
            .onConflictDoNothing();
    },

    // Events
    async createEvent(e: Omit<Event, 'id' | 'created_at'>): Promise<void> {
        const d = await getDb();
        await d.insert(s.events).values({
            id: generateId('evt'),
            ...e,
            environment_id: e.environment_id ?? null,
            event_name: e.event_name ?? null,
            metadata: e.metadata ?? null,
        });
    },

    async getEventStats(experimentId: string, environmentId?: string) {
        const d = await getDb();
        const where = environmentId
            ? and(eq(s.events.experiment_id, experimentId), eq(s.events.environment_id, environmentId))
            : eq(s.events.experiment_id, experimentId);
        return d
            .select({
                variation_id: s.events.variation_id,
                total_users: sql<number>`count(distinct ${s.events.user_id})`,
                conversions: sql<number>`count(distinct case when ${s.events.event_type} = 'conversion' then ${s.events.user_id} end)`,
            })
            .from(s.events)
            .where(where)
            .groupBy(s.events.variation_id);
    },

    // Audit
    async audit(entry: { orgId: string; actorId?: string | null; entity: string; entityId: string; action: string; diff?: unknown }) {
        const d = await getDb();
        await d.insert(s.auditLog).values({
            id: generateId('aud'),
            org_id: entry.orgId,
            actor_id: entry.actorId ?? null,
            entity: entry.entity,
            entity_id: entry.entityId,
            action: entry.action,
            diff: entry.diff === undefined ? null : JSON.stringify(entry.diff),
        });
    },

    async getAuditLog(orgId: string, limit = 50) {
        const d = await getDb();
        return d.select().from(s.auditLog).where(eq(s.auditLog.org_id, orgId)).orderBy(desc(s.auditLog.created_at)).limit(limit);
    },
};
