import { and, eq, inArray, isNull, desc, asc, sql, gte, lte, count } from 'drizzle-orm';
import { getDb } from './client';
import * as s from './schema';
import type { EnvironmentKey } from './schema';
import { generateId } from '../ids';
import { generateApiKey, hashApiKey, type ApiKeyType } from '../apiKeys';
import type { Experiment, Variation, Assignment, Event, User, Goal, ProjectDomain } from '../types';

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
    orgStatus: 'active' | 'suspended';
    type: ApiKeyType;
}

export interface OrgUpdate {
    status?: 'active' | 'suspended';
    suspended_reason?: string | null;
    plan?: string;
    monthly_visitor_limit?: number | null;
    monthly_experiment_limit?: number | null;
}

/** First instant of the current calendar month in UTC, as an ISO string. */
export function monthStartIso(now = new Date()): string {
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
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
        await this.ensureProjectSdkKeys(projectId, user.id);
        await this.audit({ orgId, actorId: user.id, entity: 'organization', entityId: orgId, action: 'create' });
        return { orgId, projectId };
    },

    async getProjectsForUser(userId: string) {
        const d = await getDb();
        return d
            .select({ id: s.projects.id, org_id: s.projects.org_id, name: s.projects.name, org_status: s.organizations.status })
            .from(s.memberships)
            .innerJoin(s.projects, eq(s.projects.org_id, s.memberships.org_id))
            .innerJoin(s.organizations, eq(s.organizations.id, s.memberships.org_id))
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


    /**
     * Ensures each of prod and dev has an active public SDK key.
     * Creates missing keys (and stores plaintext). Safe to call repeatedly.
     */
    async ensureProjectSdkKeys(projectId: string, createdBy?: string | null): Promise<void> {
        const envs = await this.getEnvironments(projectId);
        const keys = await this.listApiKeys(projectId);
        for (const envKey of ['prod', 'dev'] as const) {
            const env = envs.find((e) => e.key === envKey);
            if (!env) continue;
            const has = keys.some((k) => k.environment_id === env.id && k.type === 'sdk' && !k.revoked_at && k.key_plaintext);
            if (has) continue;
            await this.createApiKey({
                environmentId: env.id,
                type: 'sdk',
                label: 'Default',
                createdBy: createdBy ?? undefined,
            });
        }
    },

    /** Active SDK plaintext keys for prod/dev (ensures they exist first). */
    async getInstallSdkKeys(projectId: string, createdBy?: string | null): Promise<{ prod: string | null; dev: string | null }> {
        await this.ensureProjectSdkKeys(projectId, createdBy);
        const fresh = await this.listApiKeys(projectId);
        const pick = (envKey: 'prod' | 'dev') =>
            fresh.find((k) => k.environment_key === envKey && k.type === 'sdk' && !k.revoked_at && k.key_plaintext)?.key_plaintext ?? null;
        return { prod: pick('prod'), dev: pick('dev') };
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
            key_plaintext: input.type === 'sdk' ? key : null,
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
                key_plaintext: s.apiKeys.key_plaintext,
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
                orgStatus: s.organizations.status,
            })
            .from(s.apiKeys)
            .innerJoin(s.environments, eq(s.environments.id, s.apiKeys.environment_id))
            .innerJoin(s.projects, eq(s.projects.id, s.environments.project_id))
            .innerJoin(s.organizations, eq(s.organizations.id, s.projects.org_id))
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
            orgStatus: row.orgStatus,
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
        experiment: Pick<Experiment, 'id' | 'project_id' | 'user_id' | 'name' | 'status' | 'traffic_allocation'> & { description?: string | null; control_url?: string | null },
        variations: Array<Pick<Variation, 'name' | 'weight' | 'is_control'> & { description?: string | null; url?: string | null }>,
        goals: Array<Pick<Goal, 'name' | 'selector' | 'is_primary'>> = [],
    ): Promise<void> {
        const d = await getDb();
        await d.insert(s.experiments).values({ ...experiment, description: experiment.description ?? null, control_url: experiment.control_url ?? null });
        await d.insert(s.variations).values(
            variations.map((v) => ({
                id: generateId('var'),
                experiment_id: experiment.id,
                name: v.name,
                description: v.description ?? null,
                url: v.url ?? null,
                weight: v.weight,
                is_control: v.is_control,
            })),
        );
        if (goals.length) {
            await d.insert(s.goals).values(
                goals.map((g) => ({
                    id: generateId('gol'),
                    experiment_id: experiment.id,
                    name: g.name,
                    selector: g.selector,
                    is_primary: g.is_primary,
                })),
            );
        }
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
            goal_id: e.goal_id ?? null,
            metadata: e.metadata ?? null,
        });
    },


    async getEventStats(experimentId: string, environmentId?: string, goalId?: string | null) {
        const d = await getDb();
        const parts = [eq(s.events.experiment_id, experimentId)];
        if (environmentId) parts.push(eq(s.events.environment_id, environmentId));
        if (goalId) {
            parts.push(eq(s.events.event_type, 'conversion'));
            parts.push(eq(s.events.goal_id, goalId));
        }
        const where = and(...parts);
        if (goalId) {
            // Conversions for one goal; visitors still come from any event for the variation.
            const visitors = await d
                .select({
                    variation_id: s.events.variation_id,
                    total_users: sql<number>`count(distinct ${s.events.user_id})`,
                })
                .from(s.events)
                .where(environmentId ? and(eq(s.events.experiment_id, experimentId), eq(s.events.environment_id, environmentId)) : eq(s.events.experiment_id, experimentId))
                .groupBy(s.events.variation_id);
            const conversions = await d
                .select({
                    variation_id: s.events.variation_id,
                    conversions: sql<number>`count(distinct ${s.events.user_id})`,
                })
                .from(s.events)
                .where(where)
                .groupBy(s.events.variation_id);
            const convMap = new Map(conversions.map((c) => [c.variation_id, Number(c.conversions)]));
            return visitors.map((v) => ({
                variation_id: v.variation_id,
                total_users: Number(v.total_users) || 0,
                conversions: convMap.get(v.variation_id) || 0,
            }));
        }
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

    /** Raw counts behind the live stats view: per variation/event type, per goal/variation, and per day/variation. */
    async getLiveCounts(experimentId: string, environmentId?: string) {
        const d = await getDb();
        const base = environmentId
            ? and(eq(s.events.experiment_id, experimentId), eq(s.events.environment_id, environmentId))
            : eq(s.events.experiment_id, experimentId);
        const byType = await d
            .select({
                variation_id: s.events.variation_id,
                event_type: s.events.event_type,
                users: sql<number>`count(distinct ${s.events.user_id})`,
                events: sql<number>`count(*)`,
            })
            .from(s.events)
            .where(base)
            .groupBy(s.events.variation_id, s.events.event_type);
        const visitors = await d
            .select({ variation_id: s.events.variation_id, users: sql<number>`count(distinct ${s.events.user_id})` })
            .from(s.events)
            .where(base)
            .groupBy(s.events.variation_id);
        const goalRows = await d
            .select({
                goal_id: s.events.goal_id,
                variation_id: s.events.variation_id,
                users: sql<number>`count(distinct ${s.events.user_id})`,
            })
            .from(s.events)
            .where(and(base, eq(s.events.event_type, 'conversion')))
            .groupBy(s.events.goal_id, s.events.variation_id);
        const day = sql<string>`substr(${s.events.created_at}, 1, 10)`;
        const daily = await d
            .select({ day, variation_id: s.events.variation_id, users: sql<number>`count(distinct ${s.events.user_id})` })
            .from(s.events)
            .where(base)
            .groupBy(day, s.events.variation_id)
            .orderBy(day);
        const num = (n: unknown) => Number(n) || 0;
        return {
            byType: byType.map((r) => ({ ...r, users: num(r.users), events: num(r.events) })),
            visitors: visitors.map((r) => ({ ...r, users: num(r.users) })),
            goals: goalRows.map((r) => ({ ...r, users: num(r.users) })),
            daily: daily.map((r) => ({ ...r, users: num(r.users) })),
        };
    },

    async hasConversion(experimentId: string, userId: string, goalId: string): Promise<boolean> {
        const d = await getDb();
        const row = await d.query.events.findFirst({
            where: and(
                eq(s.events.experiment_id, experimentId),
                eq(s.events.user_id, userId),
                eq(s.events.goal_id, goalId),
                eq(s.events.event_type, 'conversion'),
            ),
        });
        return !!row;
    },

    async getGoals(experimentId: string): Promise<Goal[]> {
        const d = await getDb();
        return d.select().from(s.goals).where(eq(s.goals.experiment_id, experimentId)).orderBy(desc(s.goals.is_primary), asc(s.goals.created_at));
    },

    async listDomains(projectId: string): Promise<ProjectDomain[]> {
        const d = await getDb();
        return d.select().from(s.projectDomains).where(eq(s.projectDomains.project_id, projectId)).orderBy(asc(s.projectDomains.host));
    },

    async addDomain(projectId: string, host: string): Promise<ProjectDomain> {
        const d = await getDb();
        const id = generateId('dom');
        await d.insert(s.projectDomains).values({ id, project_id: projectId, host });
        return (await d.query.projectDomains.findFirst({ where: eq(s.projectDomains.id, id) }))!;
    },

    async deleteDomain(domainId: string): Promise<void> {
        const d = await getDb();
        await d.delete(s.projectDomains).where(eq(s.projectDomains.id, domainId));
    },

    async getDomainHosts(projectId: string): Promise<string[]> {
        return (await this.listDomains(projectId)).map((d) => d.host);
    },

    /** Running experiments for a project whose control or variation URL matches the page URL. */
    async findExperimentByPageUrl(projectId: string, pageUrl: string): Promise<{ experiment: Experiment; variations: Variation[]; goals: Goal[] } | null> {
        const { normalizePageUrl, urlsMatch } = await import('../domains');
        const target = normalizePageUrl(pageUrl);
        if (!target) return null;
        const d = await getDb();
        const experiments = await d
            .select()
            .from(s.experiments)
            .where(and(eq(s.experiments.project_id, projectId), eq(s.experiments.status, 'running')));
        for (const experiment of experiments) {
            const variations = await this.getVariations(experiment.id);
            const urls = [experiment.control_url, ...variations.map((v) => v.url)].filter(Boolean) as string[];
            if (urls.some((u) => urlsMatch(u, pageUrl))) {
                const goals = await this.getGoals(experiment.id);
                return { experiment, variations, goals };
            }
        }
        return null;
    },


    // Tenants, usage and quotas
    async getOrganization(orgId: string) {
        const d = await getDb();
        return (await d.query.organizations.findFirst({ where: eq(s.organizations.id, orgId) })) ?? null;
    },

    async updateOrganization(orgId: string, update: OrgUpdate): Promise<void> {
        const d = await getDb();
        const values: Partial<typeof s.organizations.$inferInsert> = { ...update };
        if (update.status === 'suspended') values.suspended_at = nowIso();
        if (update.status === 'active') {
            values.suspended_at = null;
            values.suspended_reason = null;
        }
        await d.update(s.organizations).set(values).where(eq(s.organizations.id, orgId));
    },

    /** Unique visitors assigned and events recorded across the org, since `since` (ISO) or all time. */
    async getOrgUsage(orgId: string, since?: string) {
        const d = await getDb();
        const projectIds = (await d.select({ id: s.projects.id }).from(s.projects).where(eq(s.projects.org_id, orgId))).map((p) => p.id);
        if (projectIds.length === 0) return { visitors: 0, events: 0, experiments: 0, running: 0 };
        const expIds = d.select({ id: s.experiments.id }).from(s.experiments).where(inArray(s.experiments.project_id, projectIds));
        const [v] = await d
            .select({ n: sql<number>`count(distinct ${s.assignments.user_id})` })
            .from(s.assignments)
            .where(since ? and(inArray(s.assignments.experiment_id, expIds), gte(s.assignments.assigned_at, since)) : inArray(s.assignments.experiment_id, expIds));
        const [e] = await d
            .select({ n: count() })
            .from(s.events)
            .where(since ? and(inArray(s.events.experiment_id, expIds), gte(s.events.created_at, since)) : inArray(s.events.experiment_id, expIds));
        const [x] = await d.select({ n: count() }).from(s.experiments).where(inArray(s.experiments.project_id, projectIds));
        const [r] = await d
            .select({ n: count() })
            .from(s.experiments)
            .where(and(inArray(s.experiments.project_id, projectIds), eq(s.experiments.status, 'running')));
        return { visitors: Number(v?.n ?? 0), events: Number(e?.n ?? 0), experiments: Number(x?.n ?? 0), running: Number(r?.n ?? 0) };
    },

    /** Experiments in the org first started on or after `since`. Used for the monthly experiment quota. */
    async countExperimentsStartedSince(orgId: string, since: string): Promise<number> {
        const d = await getDb();
        const [row] = await d
            .select({ n: count() })
            .from(s.experiments)
            .innerJoin(s.projects, eq(s.projects.id, s.experiments.project_id))
            .where(and(eq(s.projects.org_id, orgId), gte(s.experiments.started_at, since)));
        return Number(row?.n ?? 0);
    },

    async listOrganizations() {
        const d = await getDb();
        return d.select().from(s.organizations).orderBy(desc(s.organizations.created_at));
    },

    async getOrgMembers(orgId: string) {
        const d = await getDb();
        return d
            .select({ user_id: s.users.id, email: s.users.email, name: s.users.name, role: s.memberships.role, joined_at: s.memberships.created_at })
            .from(s.memberships)
            .innerJoin(s.users, eq(s.users.id, s.memberships.user_id))
            .where(eq(s.memberships.org_id, orgId))
            .orderBy(asc(s.memberships.created_at));
    },

    async getOrgProjects(orgId: string) {
        const d = await getDb();
        return d.select().from(s.projects).where(eq(s.projects.org_id, orgId)).orderBy(asc(s.projects.created_at));
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
    // Platform telemetry
    async bumpTelemetry(day: string, scopeType: 'platform' | 'org' | 'user' | 'project' | 'experiment', scopeId: string, metric: string, by = 1): Promise<void> {
        const d = await getDb();
        await d
            .insert(s.telemetryDaily)
            .values({ day, scope_type: scopeType, scope_id: scopeId, metric, value: by })
            .onConflictDoUpdate({
                target: [s.telemetryDaily.day, s.telemetryDaily.scope_type, s.telemetryDaily.scope_id, s.telemetryDaily.metric],
                set: { value: sql`${s.telemetryDaily.value} + ${by}` },
            });
    },

    async getTelemetryRange(opts: {
        from: string;
        to: string;
        scopeType?: 'platform' | 'org' | 'user' | 'project' | 'experiment';
        scopeId?: string;
        metrics?: string[];
    }) {
        const d = await getDb();
        const parts = [gte(s.telemetryDaily.day, opts.from), lte(s.telemetryDaily.day, opts.to)];
        if (opts.scopeType) parts.push(eq(s.telemetryDaily.scope_type, opts.scopeType));
        if (opts.scopeId) parts.push(eq(s.telemetryDaily.scope_id, opts.scopeId));
        if (opts.metrics?.length) parts.push(inArray(s.telemetryDaily.metric, opts.metrics));
        return d.select().from(s.telemetryDaily).where(and(...parts)).orderBy(asc(s.telemetryDaily.day));
    },

    async sumTelemetry(opts: {
        from: string;
        to: string;
        scopeType?: 'platform' | 'org' | 'user' | 'project' | 'experiment';
        scopeId?: string;
        metric?: string;
    }): Promise<number> {
        const d = await getDb();
        const parts = [gte(s.telemetryDaily.day, opts.from), lte(s.telemetryDaily.day, opts.to)];
        if (opts.scopeType) parts.push(eq(s.telemetryDaily.scope_type, opts.scopeType));
        if (opts.scopeId) parts.push(eq(s.telemetryDaily.scope_id, opts.scopeId));
        if (opts.metric) parts.push(eq(s.telemetryDaily.metric, opts.metric));
        const [row] = await d.select({ n: sql<number>`coalesce(sum(${s.telemetryDaily.value}), 0)` }).from(s.telemetryDaily).where(and(...parts));
        return Number(row?.n ?? 0);
    },

    async topTelemetryScopes(opts: {
        from: string;
        to: string;
        scopeType: 'org' | 'user' | 'project' | 'experiment';
        metric: string;
        limit?: number;
    }) {
        const d = await getDb();
        const lim = opts.limit ?? 50;
        return d
            .select({
                scope_id: s.telemetryDaily.scope_id,
                total: sql<number>`sum(${s.telemetryDaily.value})`.mapWith(Number),
            })
            .from(s.telemetryDaily)
            .where(and(
                eq(s.telemetryDaily.scope_type, opts.scopeType),
                eq(s.telemetryDaily.metric, opts.metric),
                gte(s.telemetryDaily.day, opts.from),
                lte(s.telemetryDaily.day, opts.to),
            ))
            .groupBy(s.telemetryDaily.scope_id)
            .orderBy(sql`sum(${s.telemetryDaily.value}) desc`)
            .limit(lim);
    },

    async createProductEvent(e: {
        id: string;
        user_id?: string | null;
        org_id?: string | null;
        project_id?: string | null;
        experiment_id?: string | null;
        action: string;
        meta?: string | null;
        ip_hash?: string | null;
    }): Promise<void> {
        const d = await getDb();
        await d.insert(s.productEvents).values({
            id: e.id,
            user_id: e.user_id ?? null,
            org_id: e.org_id ?? null,
            project_id: e.project_id ?? null,
            experiment_id: e.experiment_id ?? null,
            action: e.action,
            meta: e.meta ?? null,
            ip_hash: e.ip_hash ?? null,
        });
    },

    async listProductEvents(opts: {
        from: string;
        to: string;
        userId?: string;
        orgId?: string;
        action?: string;
        limit?: number;
    }) {
        const d = await getDb();
        const parts = [gte(s.productEvents.occurred_at, opts.from), lte(s.productEvents.occurred_at, opts.to + 'T23:59:59.999Z')];
        if (opts.userId) parts.push(eq(s.productEvents.user_id, opts.userId));
        if (opts.orgId) parts.push(eq(s.productEvents.org_id, opts.orgId));
        if (opts.action) parts.push(eq(s.productEvents.action, opts.action));
        return d.select().from(s.productEvents).where(and(...parts)).orderBy(desc(s.productEvents.occurred_at)).limit(opts.limit ?? 200);
    },

    async touchUserActivity(userId: string, kind: 'login' | 'active'): Promise<void> {
        const d = await getDb();
        const now = nowIso();
        if (kind === 'login') {
            await d.update(s.users).set({ last_login_at: now, last_active_at: now }).where(eq(s.users.id, userId));
        } else {
            // Throttle active writes: only if last_active_at is null or older than 5 minutes
            const u = await d.query.users.findFirst({ where: eq(s.users.id, userId) });
            if (!u) return;
            if (u.last_active_at && Date.now() - Date.parse(u.last_active_at) < 5 * 60_000) return;
            await d.update(s.users).set({ last_active_at: now }).where(eq(s.users.id, userId));
        }
    },

    async listUsersForTelemetry(limit = 500) {
        const d = await getDb();
        return d.select({
            id: s.users.id,
            email: s.users.email,
            name: s.users.name,
            created_at: s.users.created_at,
            last_active_at: s.users.last_active_at,
            last_login_at: s.users.last_login_at,
        }).from(s.users).orderBy(desc(s.users.created_at)).limit(limit);
    },

    async getUser(id: string) {
        const d = await getDb();
        return (await d.query.users.findFirst({ where: eq(s.users.id, id) })) ?? null;
    },

    async countUsers(): Promise<number> {
        const d = await getDb();
        const [row] = await d.select({ n: count() }).from(s.users);
        return Number(row?.n ?? 0);
    },

    async countActiveUsersSince(sinceIso: string): Promise<number> {
        const d = await getDb();
        const [row] = await d.select({ n: count() }).from(s.users).where(gte(s.users.last_active_at, sinceIso));
        return Number(row?.n ?? 0);
    },

    async listApiKeyUsage(limit = 100) {
        const d = await getDb();
        return d
            .select({
                id: s.apiKeys.id,
                prefix: s.apiKeys.prefix,
                type: s.apiKeys.type,
                label: s.apiKeys.label,
                last_used_at: s.apiKeys.last_used_at,
                created_at: s.apiKeys.created_at,
                revoked_at: s.apiKeys.revoked_at,
                environment_id: s.apiKeys.environment_id,
            })
            .from(s.apiKeys)
            .orderBy(desc(s.apiKeys.last_used_at))
            .limit(limit);
    },

};
