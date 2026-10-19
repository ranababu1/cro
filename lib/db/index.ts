import { and, eq, inArray, isNull, desc, asc, sql, gte, lte, count, like } from 'drizzle-orm';
import type { BatchItem } from 'drizzle-orm/batch';
import { getDb } from './client';
import * as s from './schema';
import type { EnvironmentKey } from './schema';
import { generateId } from '../ids';
import { cached, clearConfigCache } from '../configCache';
import { rolledEventStats, rolledEventStatsByGoal, rolledLiveCounts } from '../rollups';
import { generateApiKey, hashApiKey, type ApiKeyType } from '../apiKeys';
import type { Experiment, Variation, Assignment, Event, User, Goal, ProjectDomain } from '../types';
import { OTHER_PAGES, TRAFFIC_MAX_PAGES_PER_DAY } from '../traffic';
import { ERROR_MAX_PER_DAY, OTHER_ERRORS, PAGES_WITH_ERRORS } from '../jsErrors';
import { SURVEY_MAX_RESPONSES_PER_DAY } from '../surveys';

/** A new event. Revenue is optional and only set for revenue goals. */
type NewEvent = Omit<Event, 'id' | 'created_at' | 'revenue'> & { revenue?: number | null };

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
    monthly_pageview_limit?: number | null;
    special_friend?: boolean;
    custom_allowances?: string | null;
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

    async createUser(data: { email: string; name: string; image?: string | null; first_name?: string | null; last_name?: string | null; onboarding_pending?: boolean }): Promise<User> {
        const d = await getDb();
        const id = generateId('usr');
        await d.insert(s.users).values({
            id, email: data.email, name: data.name, image: data.image ?? null,
            first_name: data.first_name ?? null, last_name: data.last_name ?? null, onboarding_pending: data.onboarding_pending ?? false,
        });
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
        clearConfigCache();
        const d = await getDb();
        await d.update(s.apiKeys).set({ revoked_at: nowIso() }).where(and(eq(s.apiKeys.id, keyId), isNull(s.apiKeys.revoked_at)));
    },

    /** Looks up an active key by its plaintext value. Returns null for unknown or revoked keys. */
    async authenticateApiKey(plaintext: string): Promise<SdkKeyContext | null> {
        const d = await getDb();
        const rows = await cached(`key:${hashApiKey(plaintext)}`, () => d
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
            .limit(1));
        const row = rows[0];
        if (!row || row.revokedAt) return null;
        // Write last_used_at at most once a minute per key to keep hot paths cheap.
        if (!row.lastUsedAt || Date.now() - Date.parse(row.lastUsedAt) > 60_000) {
            const at = nowIso();
            row.lastUsedAt = at;
            await d.update(s.apiKeys).set({ last_used_at: at }).where(eq(s.apiKeys.id, row.keyId));
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
        experiment: Pick<Experiment, 'id' | 'project_id' | 'user_id' | 'name' | 'status' | 'traffic_allocation'> & { description?: string | null; control_url?: string | null; targeting?: string | null },
        variations: Array<Pick<Variation, 'name' | 'weight' | 'is_control'> & { description?: string | null; url?: string | null }>,
        goals: Array<Pick<Goal, 'name' | 'selector' | 'is_primary'> & { type?: Goal['type']; match_type?: Goal['match_type'] }> = [],
    ): Promise<void> {
        clearConfigCache();
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
                goals.map((g, i) => ({
                    id: generateId('gol'),
                    position: i,
                    experiment_id: experiment.id,
                    name: g.name,
                    selector: g.selector,
                    type: g.type ?? 'click',
                    match_type: g.match_type ?? null,
                    is_primary: g.is_primary,
                })),
            );
        }
    },

    async updateExperiment(
        id: string,
        updates: Partial<Pick<Experiment, 'name' | 'description' | 'status' | 'traffic_allocation' | 'targeting' | 'started_at' | 'ended_at'>>,
    ): Promise<void> {
        clearConfigCache();
        const d = await getDb();
        await d.update(s.experiments).set({ ...updates, updated_at: nowIso() }).where(eq(s.experiments.id, id));
    },

    async deleteExperiment(id: string): Promise<void> {
        clearConfigCache();
        const d = await getDb();
        await d.delete(s.experiments).where(eq(s.experiments.id, id));
    },

    // Variations
    async getVariations(experimentId: string): Promise<Variation[]> {
        const d = await getDb();
        return d.select().from(s.variations).where(eq(s.variations.experiment_id, experimentId)).orderBy(asc(s.variations.created_at), asc(s.variations.id));
    },

    /** Updates weights and paused flags of existing variations in one batch. */
    async updateVariationAllocation(experimentId: string, rows: Array<{ id: string; weight: number; paused: boolean }>): Promise<void> {
        clearConfigCache();
        const d = await getDb();
        for (const r of rows) {
            await d.update(s.variations).set({ weight: r.weight, paused: r.paused }).where(and(eq(s.variations.id, r.id), eq(s.variations.experiment_id, experimentId)));
        }
        await d.update(s.experiments).set({ updated_at: nowIso() }).where(eq(s.experiments.id, experimentId));
    },

    /** Visual editor: replaces the change list of one variation (JSON text, or null to clear). */
    async setVariationChanges(experimentId: string, variationId: string, changes: string | null): Promise<void> {
        clearConfigCache();
        const d = await getDb();
        await d.update(s.variations).set({ changes }).where(and(eq(s.variations.id, variationId), eq(s.variations.experiment_id, experimentId)));
        await d.update(s.experiments).set({ updated_at: nowIso() }).where(eq(s.experiments.id, experimentId));
    },

    /** Turns auto-shift on or off. Turning it on makes the next check due right away. */
    /** Heatmap sample and stop rules. Only the given fields change; restart starts a new collection period. */
    async setHeatmapSettings(experimentId: string, u: { sample_percent?: number | null; stop_days?: number | null; stop_views?: number | null; restart?: boolean }): Promise<void> {
        clearConfigCache();
        const d = await getDb();
        const values: Partial<typeof s.experiments.$inferInsert> = { updated_at: nowIso() };
        if (u.sample_percent !== undefined) values.heatmap_sample = u.sample_percent;
        if (u.stop_days !== undefined) values.heatmap_stop_days = u.stop_days;
        if (u.stop_views !== undefined) values.heatmap_stop_views = u.stop_views;
        if (u.restart) { values.heatmap_since = nowIso(); values.heatmap_views = 0; }
        await d.update(s.experiments).set(values).where(eq(s.experiments.id, experimentId));
    },

    /** Adds captured page views to the heatmap counter (one statement per capture batch that ends a page view). */
    async addHeatmapViews(experimentId: string, n: number): Promise<void> {
        if (n <= 0) return;
        const d = await getDb();
        await d.run(sql`UPDATE experiments SET heatmap_views = heatmap_views + ${n} WHERE id = ${experimentId}`);
    },

    async setAutoShift(experimentId: string, enabled: boolean): Promise<void> {
        clearConfigCache();
        const d = await getDb();
        await d.update(s.experiments).set({ auto_shift: enabled, auto_shift_at: null, updated_at: nowIso() }).where(eq(s.experiments.id, experimentId));
    },

    /**
     * Claims the next auto-shift check for a running test when the last one is older than cutoffIso.
     * Only one caller wins, so concurrent requests do not rebalance twice.
     */
    async claimAutoShift(experimentId: string, cutoffIso: string, nowIsoValue: string): Promise<boolean> {
        const d = await getDb();
        const r = await d.update(s.experiments).set({ auto_shift_at: nowIsoValue })
            .where(and(
                eq(s.experiments.id, experimentId),
                eq(s.experiments.auto_shift, true),
                eq(s.experiments.status, 'running'),
                sql`(${s.experiments.auto_shift_at} is null or ${s.experiments.auto_shift_at} < ${cutoffIso})`,
            ))
            .returning({ id: s.experiments.id });
        return r.length > 0;
    },

    async addGoal(experimentId: string, g: Pick<Goal, 'name' | 'selector' | 'is_primary' | 'type' | 'match_type'>): Promise<Goal> {
        clearConfigCache();
        const d = await getDb();
        const id = generateId('gol');
        if (g.is_primary) await d.update(s.goals).set({ is_primary: false }).where(eq(s.goals.experiment_id, experimentId));
        const [{ next }] = await d.select({ next: sql<number>`coalesce(max(${s.goals.position}) + 1, 0)` }).from(s.goals).where(eq(s.goals.experiment_id, experimentId));
        await d.insert(s.goals).values({ id, experiment_id: experimentId, ...g, position: Number(next) });
        return (await d.query.goals.findFirst({ where: eq(s.goals.id, id) }))!;
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

    /** Enrolled visitors per variation. */
    async getAssignmentCounts(experimentId: string, environmentId?: string): Promise<Map<string, number>> {
        const d = await getDb();
        const where = environmentId
            ? and(eq(s.assignments.experiment_id, experimentId), eq(s.assignments.environment_id, environmentId))
            : eq(s.assignments.experiment_id, experimentId);
        const rows = await d.select({ variation_id: s.assignments.variation_id, n: count() }).from(s.assignments).where(where).groupBy(s.assignments.variation_id);
        return new Map(rows.map((r) => [r.variation_id, Number(r.n)]));
    },

    /** Returns true when a new assignment row was written. */
    async createAssignment(a: { experiment_id: string; variation_id: string; user_id: string; environment_id?: string | null }): Promise<boolean> {
        const d = await getDb();
        const rows = await d
            .insert(s.assignments)
            .values({ id: generateId('asn'), ...a, environment_id: a.environment_id ?? null })
            .onConflictDoNothing()
            .returning({ id: s.assignments.id });
        return rows.length > 0;
    },

    // Events
    /** Inserts many events in one statement. */
    async createEvents(list: Array<NewEvent>): Promise<void> {
        if (!list.length) return;
        const d = await getDb();
        await d.insert(s.events).values(list.map((e) => ({
            id: generateId('evt'),
            ...e,
            environment_id: e.environment_id ?? null,
            event_name: e.event_name ?? null,
            goal_id: e.goal_id ?? null,
            metadata: e.metadata ?? null,
            revenue: e.revenue ?? null,
        })));
    },

    async createEvent(e: NewEvent): Promise<void> {
        const d = await getDb();
        await d.insert(s.events).values({
            id: generateId('evt'),
            ...e,
            environment_id: e.environment_id ?? null,
            event_name: e.event_name ?? null,
            goal_id: e.goal_id ?? null,
            metadata: e.metadata ?? null,
            revenue: e.revenue ?? null,
        });
    },


    /** Results counts from daily rollups plus today's raw events. Matches getEventStatsRaw exactly. */
    async getEventStats(experimentId: string, environmentId?: string, goalId?: string | null) {
        return rolledEventStats(experimentId, environmentId, goalId);
    },

    /** Stats keyed by goal id ('' is the whole test), from one rollup read. */
    async getEventStatsByGoal(experimentId: string, environmentId: string | undefined, goalIds: string[]) {
        return rolledEventStatsByGoal(experimentId, environmentId, goalIds);
    },

    /** Reference query over raw events. Kept for tests and as a fallback. */
    async getEventStatsRaw(experimentId: string, environmentId?: string, goalId?: string | null) {
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
        return rolledLiveCounts(experimentId, environmentId);
    },

    /** Reference query over raw events. Kept for tests and as a fallback. */
    async getLiveCountsRaw(experimentId: string, environmentId?: string) {
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

    /** Running experiments in a project with their goals, for page-visit and custom-event goal matching. */
    async getRunningExperimentGoals(projectId: string): Promise<Array<{ experiment: Experiment; goals: Goal[] }>> {
        return (await this.getRunningConfig(projectId)).map(({ experiment, goals }) => ({ experiment, goals }));
    },

    /** Running experiments with variations and goals, cached briefly for the SDK hot path. */
    async getRunningConfig(projectId: string): Promise<Array<{ experiment: Experiment; variations: Variation[]; goals: Goal[] }>> {
        return cached(`run:${projectId}`, async () => {
            const d = await getDb();
            const experiments = await d.select().from(s.experiments).where(and(eq(s.experiments.project_id, projectId), eq(s.experiments.status, 'running')));
            const out: Array<{ experiment: Experiment; variations: Variation[]; goals: Goal[] }> = [];
            for (const experiment of experiments) out.push({ experiment, variations: await this.getVariations(experiment.id), goals: await this.getGoals(experiment.id) });
            return out;
        });
    },

    /** Experiment, variations and goals for the track endpoint, cached briefly. */
    async getExperimentConfig(experimentId: string): Promise<{ experiment: Experiment; variations: Variation[]; goals: Goal[] } | null> {
        return cached(`exp:${experimentId}`, async () => {
            const experiment = await this.getExperiment(experimentId);
            if (!experiment) return null;
            return { experiment, variations: await this.getVariations(experimentId), goals: await this.getGoals(experimentId) };
        });
    },

    // Share links
    async getActiveShareLink(experimentId: string) {
        const d = await getDb();
        return (await d.query.shareLinks.findFirst({ where: and(eq(s.shareLinks.experiment_id, experimentId), isNull(s.shareLinks.revoked_at)) })) ?? null;
    },

    async createShareLink(experimentId: string, createdBy: string | null) {
        const d = await getDb();
        const { randomBytes } = await import('node:crypto');
        const row = { id: generateId('shr'), experiment_id: experimentId, token: randomBytes(32).toString('base64url'), created_by: createdBy };
        await d.insert(s.shareLinks).values(row);
        return (await d.query.shareLinks.findFirst({ where: eq(s.shareLinks.id, row.id) }))!;
    },

    async revokeShareLinks(experimentId: string): Promise<void> {
        const d = await getDb();
        await d.update(s.shareLinks).set({ revoked_at: nowIso() }).where(and(eq(s.shareLinks.experiment_id, experimentId), isNull(s.shareLinks.revoked_at)));
    },

    /** Experiment for an active share token, or null. Suspended orgs never resolve. */
    async getSharedExperiment(token: string): Promise<Experiment | null> {
        if (!token || token.length < 20 || token.length > 100) return null;
        const d = await getDb();
        const link = await d.query.shareLinks.findFirst({ where: and(eq(s.shareLinks.token, token), isNull(s.shareLinks.revoked_at)) });
        if (!link) return null;
        const experiment = await this.getExperiment(link.experiment_id);
        if (!experiment) return null;
        const project = await this.getProject(experiment.project_id);
        const org = project ? await this.getOrganization(project.org_id) : null;
        if (!org || org.status !== 'active') return null;
        return experiment;
    },

    async getGoals(experimentId: string): Promise<Goal[]> {
        const d = await getDb();
        return d.select().from(s.goals).where(eq(s.goals.experiment_id, experimentId)).orderBy(asc(s.goals.position), asc(s.goals.created_at));
    },

    /** Removes a goal. Its recorded conversions stay in the event log. If it was primary, the first remaining goal becomes primary. */
    async deleteGoal(experimentId: string, goalId: string): Promise<boolean> {
        clearConfigCache();
        const d = await getDb();
        const goal = await d.query.goals.findFirst({ where: and(eq(s.goals.id, goalId), eq(s.goals.experiment_id, experimentId)) });
        if (!goal) return false;
        await d.delete(s.goals).where(eq(s.goals.id, goalId));
        const rest = await this.getGoals(experimentId);
        for (const [i, g] of rest.entries()) await d.update(s.goals).set({ position: i, ...(goal.is_primary && i === 0 ? { is_primary: true } : {}) }).where(eq(s.goals.id, g.id));
        return true;
    },

    /** Sets goal order. ids must be exactly the experiment's goal ids. */
    async reorderGoals(experimentId: string, ids: string[]): Promise<boolean> {
        const d = await getDb();
        const current = await this.getGoals(experimentId);
        if (ids.length !== current.length || new Set(ids).size !== ids.length || !ids.every((id) => current.some((g) => g.id === id))) return false;
        clearConfigCache();
        await d.batch(ids.map((id, i) => d.update(s.goals).set({ position: i }).where(and(eq(s.goals.id, id), eq(s.goals.experiment_id, experimentId)))) as [never, ...never[]]);
        return true;
    },

    /** Makes one goal the primary goal. */
    async setPrimaryGoal(experimentId: string, goalId: string): Promise<boolean> {
        const d = await getDb();
        const goal = await d.query.goals.findFirst({ where: and(eq(s.goals.id, goalId), eq(s.goals.experiment_id, experimentId)) });
        if (!goal) return false;
        clearConfigCache();
        await d.update(s.goals).set({ is_primary: false }).where(eq(s.goals.experiment_id, experimentId));
        await d.update(s.goals).set({ is_primary: true }).where(eq(s.goals.id, goalId));
        return true;
    },

    async listDomains(projectId: string): Promise<ProjectDomain[]> {
        const d = await getDb();
        return d.select().from(s.projectDomains).where(eq(s.projectDomains.project_id, projectId)).orderBy(asc(s.projectDomains.host));
    },

    async addDomain(projectId: string, host: string): Promise<ProjectDomain> {
        clearConfigCache();
        const d = await getDb();
        const id = generateId('dom');
        await d.insert(s.projectDomains).values({ id, project_id: projectId, host });
        return (await d.query.projectDomains.findFirst({ where: eq(s.projectDomains.id, id) }))!;
    },

    async deleteDomain(domainId: string): Promise<void> {
        clearConfigCache();
        const d = await getDb();
        await d.delete(s.projectDomains).where(eq(s.projectDomains.id, domainId));
    },

    async getDomainHosts(projectId: string): Promise<string[]> {
        return cached(`dom:${projectId}`, async () => (await this.listDomains(projectId)).map((d) => d.host));
    },

    /** Running experiments for a project whose control or variation URL matches the page URL. */
    async findExperimentByPageUrl(projectId: string, pageUrl: string): Promise<{ experiment: Experiment; variations: Variation[]; goals: Goal[] } | null> {
        const { normalizePageUrl, urlsMatch } = await import('../domains');
        const target = normalizePageUrl(pageUrl);
        if (!target) return null;
        for (const { experiment, variations, goals } of await this.getRunningConfig(projectId)) {
            const urls = [experiment.control_url, ...variations.map((v) => v.url)].filter(Boolean) as string[];
            if (urls.some((u) => urlsMatch(u, pageUrl))) {
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
        clearConfigCache();
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

    async getMonthlyPageviews(orgId: string, month: string): Promise<number> {
        const d = await getDb();
        const row = await d.query.usageMonthly.findFirst({ where: and(eq(s.usageMonthly.org_id, orgId), eq(s.usageMonthly.month, month)) });
        return row?.pageviews ?? 0;
    },

    async addMonthlyPageviews(orgId: string, month: string, by = 1): Promise<void> {
        const d = await getDb();
        await d
            .insert(s.usageMonthly)
            .values({ org_id: orgId, month, pageviews: by })
            .onConflictDoUpdate({ target: [s.usageMonthly.org_id, s.usageMonthly.month], set: { pageviews: sql`${s.usageMonthly.pageviews} + ${by}` } });
    },

    /** Marks a visitor as seen this month. Returns true (and bumps the counter) the first time only. */
    async addMonthlyVisitor(orgId: string, month: string, userId: string, day = new Date().toISOString().slice(0, 10)): Promise<boolean> {
        const d = await getDb();
        const rows = await d.insert(s.orgVisitorsMonthly).values({ org_id: orgId, month, user_id: userId }).onConflictDoNothing().returning({ u: s.orgVisitorsMonthly.user_id });
        if (!rows.length) return false;
        await d
            .insert(s.usageDaily)
            .values({ org_id: orgId, day, visitors: 1 })
            .onConflictDoUpdate({ target: [s.usageDaily.org_id, s.usageDaily.day], set: { visitors: sql`${s.usageDaily.visitors} + 1` } });
        await d
            .insert(s.usageMonthly)
            .values({ org_id: orgId, month, pageviews: 0, visitors: 1 })
            .onConflictDoUpdate({ target: [s.usageMonthly.org_id, s.usageMonthly.month], set: { visitors: sql`${s.usageMonthly.visitors} + 1` } });
        return true;
    },

    async isMonthlyVisitor(orgId: string, month: string, userId: string): Promise<boolean> {
        const d = await getDb();
        return !!(await d.query.orgVisitorsMonthly.findFirst({ where: and(eq(s.orgVisitorsMonthly.org_id, orgId), eq(s.orgVisitorsMonthly.month, month), eq(s.orgVisitorsMonthly.user_id, userId)) }));
    },

    async getDailyVisitors(orgId: string, day: string): Promise<number> {
        const d = await getDb();
        const row = await d.query.usageDaily.findFirst({ where: and(eq(s.usageDaily.org_id, orgId), eq(s.usageDaily.day, day)) });
        return row?.visitors ?? 0;
    },

    /** Running experiments across every project in the org. */
    async countRunningExperiments(orgId: string): Promise<number> {
        const d = await getDb();
        const [row] = await d
            .select({ n: count() })
            .from(s.experiments)
            .innerJoin(s.projects, eq(s.projects.id, s.experiments.project_id))
            .where(and(eq(s.projects.org_id, orgId), eq(s.experiments.status, 'running')));
        return Number(row?.n ?? 0);
    },

    async incrementExperimentsStarted(orgId: string): Promise<void> {
        const d = await getDb();
        await d.update(s.organizations).set({ experiments_started_total: sql`${s.organizations.experiments_started_total} + 1` }).where(eq(s.organizations.id, orgId));
    },

    async getMonthlyVisitors(orgId: string, month: string): Promise<number> {
        const d = await getDb();
        const row = await d.query.usageMonthly.findFirst({ where: and(eq(s.usageMonthly.org_id, orgId), eq(s.usageMonthly.month, month)) });
        return row?.visitors ?? 0;
    },

    async getOrgMembers(orgId: string) {
        const d = await getDb();
        return d
            .select({
                user_id: s.users.id, email: s.users.email, name: s.users.name, role: s.memberships.role, joined_at: s.memberships.created_at,
                first_name: s.users.first_name, last_name: s.users.last_name, country: s.users.country, phone: s.users.phone, company: s.users.company,
                job_role: s.users.job_role, company_size: s.users.company_size, heard_from: s.users.heard_from, primary_goal: s.users.primary_goal,
                marketing_opt_in: s.users.marketing_opt_in, profile_completed_at: s.users.profile_completed_at,
            })
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
    async updateUserProfile(id: string, p: import('../profile').ProfileInput) {
        const d = await getDb();
        const nowIso = new Date().toISOString();
        await d.update(s.users).set({ ...p, profile_completed_at: nowIso, onboarding_pending: false }).where(eq(s.users.id, id));
    },
    async skipOnboarding(id: string) {
        const d = await getDb();
        await d.update(s.users).set({ onboarding_pending: false }).where(eq(s.users.id, id));
    },
    async dismissProfilePrompt(id: string) {
        const d = await getDb();
        await d.update(s.users).set({ profile_prompt_dismissed_at: new Date().toISOString() }).where(eq(s.users.id, id));
    },
    /** All users with their first org, for the admin profile export. */
    async listUserProfiles() {
        const d = await getDb();
        const rows = await d.select({ user: s.users, org_id: s.memberships.org_id, org_name: s.organizations.name, plan: s.organizations.plan })
            .from(s.users)
            .leftJoin(s.memberships, eq(s.memberships.user_id, s.users.id))
            .leftJoin(s.organizations, eq(s.organizations.id, s.memberships.org_id))
            .orderBy(asc(s.users.created_at));
        const seen = new Set<string>();
        return rows.filter((r) => (seen.has(r.user.id) ? false : (seen.add(r.user.id), true)));
    },
    async listFunnels(experimentId: string) {
        const d = await getDb();
        return d.select().from(s.funnels).where(eq(s.funnels.experiment_id, experimentId)).orderBy(asc(s.funnels.created_at));
    },

    async createFunnel(experimentId: string, name: string, steps: string[]) {
        const d = await getDb();
        const id = generateId('fnl');
        await d.insert(s.funnels).values({ id, experiment_id: experimentId, name, steps: JSON.stringify(steps) });
        return id;
    },

    async deleteFunnel(experimentId: string, funnelId: string): Promise<boolean> {
        const d = await getDb();
        const r = await d.delete(s.funnels).where(and(eq(s.funnels.id, funnelId), eq(s.funnels.experiment_id, experimentId))).returning({ id: s.funnels.id });
        return r.length > 0;
    },

    /** First conversion time per visitor, variation and goal, for the given goals. Reads raw conversion events only. */
    async getFirstGoalHits(experimentId: string, environmentId: string | undefined, goalIds: string[]) {
        if (!goalIds.length) return [];
        const d = await getDb();
        const rows = await d
            .select({ variation_id: s.events.variation_id, user_id: s.events.user_id, goal_id: s.events.goal_id, t: sql<string>`min(${s.events.created_at})` })
            .from(s.events)
            .where(and(
                eq(s.events.experiment_id, experimentId),
                eq(s.events.event_type, 'conversion'),
                inArray(s.events.goal_id, goalIds),
                environmentId ? eq(s.events.environment_id, environmentId) : undefined,
            ))
            .groupBy(s.events.variation_id, s.events.user_id, s.events.goal_id);
        return rows.map((r) => ({ variation_id: r.variation_id, user_id: r.user_id, goal_id: r.goal_id ?? '', t: r.t }));
    },

    /**
     * Revenue per variation and goal for revenue goals: buyers, orders, total and the sum of squared
     * per-visitor totals (for the variance). Reads raw conversion events that carry a revenue amount.
     */
    async getRevenueStats(experimentId: string, environmentId: string | undefined, goalIds: string[]) {
        if (!goalIds.length) return [];
        const d = await getDb();
        const env = environmentId ? sql` and environment_id = ${environmentId}` : sql``;
        const rows = await d.all<{ variation_id: string; goal_id: string; buyers: number; orders: number; revenue: number; sumsq: number }>(sql`
            select variation_id, goal_id, count(*) as buyers, sum(o) as orders, sum(r) as revenue, sum(r * r) as sumsq from (
                select variation_id, goal_id, user_id, count(*) as o, sum(revenue) as r from events
                where experiment_id = ${experimentId} and event_type = 'conversion' and revenue is not null
                and goal_id in (${sql.join(goalIds.map((g) => sql`${g}`), sql`, `)})${env}
                group by variation_id, goal_id, user_id
            ) group by variation_id, goal_id`);
        return rows.map((r) => ({ variation_id: r.variation_id, goal_id: r.goal_id, buyers: Number(r.buyers) || 0, orders: Number(r.orders) || 0, revenue: Number(r.revenue) || 0, sumsq: Number(r.sumsq) || 0 }));
    },

    /** Revenue events a visitor already sent for one goal, to cap repeats. */
    async countRevenueEvents(experimentId: string, userId: string, goalId: string): Promise<number> {
        const d = await getDb();
        const [r] = await d.select({ n: sql<number>`count(*)` }).from(s.events).where(and(
            eq(s.events.experiment_id, experimentId), eq(s.events.user_id, userId), eq(s.events.goal_id, goalId),
            eq(s.events.event_type, 'conversion'), sql`${s.events.revenue} is not null`,
        ));
        return Number(r?.n ?? 0);
    },

    async recordPluginDownload(row: { plugin: string; version: string; orgId: string; userId: string; ipHash: string | null }): Promise<string> {
        const d = await getDb();
        const id = generateId('dl');
        await d.insert(s.pluginDownloads).values({ id, plugin: row.plugin, version: row.version, org_id: row.orgId, user_id: row.userId, ip_hash: row.ipHash });
        return id;
    },

    /** Downloads by a user and by their org since an ISO time, for rate limiting. */
    async countPluginDownloads(userId: string, orgId: string, sinceIso: string): Promise<{ user: number; org: number }> {
        const d = await getDb();
        const [u] = await d.select({ n: sql<number>`count(*)` }).from(s.pluginDownloads).where(and(eq(s.pluginDownloads.user_id, userId), gte(s.pluginDownloads.created_at, sinceIso)));
        const [o] = await d.select({ n: sql<number>`count(*)` }).from(s.pluginDownloads).where(and(eq(s.pluginDownloads.org_id, orgId), gte(s.pluginDownloads.created_at, sinceIso)));
        return { user: Number(u?.n ?? 0), org: Number(o?.n ?? 0) };
    },

    async listPluginDownloads(limit = 200) {
        const d = await getDb();
        return d
            .select({ id: s.pluginDownloads.id, plugin: s.pluginDownloads.plugin, version: s.pluginDownloads.version, org_id: s.pluginDownloads.org_id, org_name: s.organizations.name, user_email: s.users.email, created_at: s.pluginDownloads.created_at })
            .from(s.pluginDownloads)
            .leftJoin(s.organizations, eq(s.organizations.id, s.pluginDownloads.org_id))
            .leftJoin(s.users, eq(s.users.id, s.pluginDownloads.user_id))
            .orderBy(desc(s.pluginDownloads.created_at))
            .limit(limit);
    },

    async getAbuseLog(limit = 200) {
        const d = await getDb();
        return d.select().from(s.auditLog).where(like(s.auditLog.action, 'abuse:%')).orderBy(desc(s.auditLog.created_at)).limit(limit);
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

    /** Applies many counter increments in one round trip. */
    /** Telemetry counters and traffic overview counters, upserted in one batch (one round trip). */
    async bumpTelemetryBatch(
        rows: Array<{ day: string; scope_type: 'platform' | 'org' | 'user' | 'project' | 'experiment'; scope_id: string; metric: string; value: number }>,
        traffic: Array<{ day: string; environment_id: string; project_id: string; dim: string; key: string; views: number }> = [],
        errors: Array<{ day: string; experiment_id: string; variation_id: string; fingerprint: string; kind: string; message: string; source: string; line: number; count: number }> = [],
        popupRows: Array<{ day: string; popup_id: string; metric: string; count: number }> = [],
        surveyRows: Array<{ day: string; survey_id: string; metric: string; count: number }> = [],
        answers: Array<{ day: string; survey_id: string; answer: string; comment: string | null; path: string }> = [],
    ): Promise<void> {
        if (!rows.length && !traffic.length && !errors.length && !popupRows.length && !surveyRows.length && !answers.length) return;
        const d = await getDb();
        const stmts: BatchItem<'sqlite'>[] = [
            ...rows.map((r) => d
                .insert(s.telemetryDaily)
                .values(r)
                .onConflictDoUpdate({
                    target: [s.telemetryDaily.day, s.telemetryDaily.scope_type, s.telemetryDaily.scope_id, s.telemetryDaily.metric],
                    set: { value: sql`${s.telemetryDaily.value} + ${r.value}` },
                })),
            ...traffic.flatMap((r): BatchItem<'sqlite'>[] => r.dim === 'page' && r.key !== OTHER_PAGES ? cappedPageUpsert(d, r) : [d
                .insert(s.trafficDaily)
                .values(r)
                .onConflictDoUpdate({
                    target: [s.trafficDaily.day, s.trafficDaily.environment_id, s.trafficDaily.dim, s.trafficDaily.key],
                    set: { views: sql`${s.trafficDaily.views} + ${r.views}` },
                })]),
            // A popup deleted since the view was buffered is skipped instead of failing the whole batch.
            ...popupRows.map((r) => d.run(sql`INSERT INTO popup_daily (day, popup_id, metric, count)
                SELECT ${r.day}, ${r.popup_id}, ${r.metric}, ${r.count} WHERE EXISTS (SELECT 1 FROM popups WHERE id = ${r.popup_id})
                ON CONFLICT (day, popup_id, metric) DO UPDATE SET count = count + excluded.count`)),
            ...surveyRows.map((r) => d.run(sql`INSERT INTO survey_daily (day, survey_id, metric, count)
                SELECT ${r.day}, ${r.survey_id}, ${r.metric}, ${r.count} WHERE EXISTS (SELECT 1 FROM surveys WHERE id = ${r.survey_id})
                ON CONFLICT (day, survey_id, metric) DO UPDATE SET count = count + excluded.count`)),
            // Individual answers, capped per survey per day; the response total in survey_daily still counts the rest.
            ...answers.map((r) => d.run(sql`INSERT INTO survey_responses (survey_id, day, answer, comment, path)
                SELECT ${r.survey_id}, ${r.day}, ${r.answer}, ${r.comment}, ${r.path}
                WHERE EXISTS (SELECT 1 FROM surveys WHERE id = ${r.survey_id})
                AND (SELECT count(*) FROM survey_responses WHERE survey_id = ${r.survey_id} AND day = ${r.day}) < ${SURVEY_MAX_RESPONSES_PER_DAY}`)),
            ...errors.flatMap((r): BatchItem<'sqlite'>[] => r.fingerprint === PAGES_WITH_ERRORS || r.fingerprint === OTHER_ERRORS ? [plainErrorUpsert(d, r)] : cappedErrorUpsert(d, r)),
        ];
        await d.batch(stmts as [BatchItem<'sqlite'>, ...BatchItem<'sqlite'>[]]);
    },

    // Popups (paid)
    async listPopups(projectId: string) {
        const d = await getDb();
        return d.select().from(s.popups).where(eq(s.popups.project_id, projectId)).orderBy(desc(s.popups.created_at));
    },

    async getPopup(id: string) {
        const d = await getDb();
        return (await d.select().from(s.popups).where(eq(s.popups.id, id)))[0] ?? null;
    },

    async createPopup(p: { project_id: string; name: string; status: 'draft' | 'active' | 'paused'; config: string }) {
        clearConfigCache();
        const d = await getDb();
        const id = generateId('pop');
        await d.insert(s.popups).values({ id, ...p });
        return (await this.getPopup(id))!;
    },

    async updatePopup(id: string, update: { name?: string; status?: 'draft' | 'active' | 'paused'; config?: string }) {
        clearConfigCache();
        const d = await getDb();
        await d.update(s.popups).set({ ...update, updated_at: nowIso() }).where(eq(s.popups.id, id));
        return this.getPopup(id);
    },

    async deletePopup(id: string): Promise<void> {
        clearConfigCache();
        const d = await getDb();
        await d.delete(s.popups).where(eq(s.popups.id, id));
    },

    /** Active popups of a project for the SDK, cached briefly like the running test config. */
    async getActivePopups(projectId: string) {
        return cached(`pop:${projectId}`, async () => {
            const d = await getDb();
            return d.select().from(s.popups).where(and(eq(s.popups.project_id, projectId), eq(s.popups.status, 'active')));
        });
    },

    async getPopupStats(projectId: string, from: string, to: string) {
        const d = await getDb();
        const rows = await d.select({ popup_id: s.popupDaily.popup_id, metric: s.popupDaily.metric, count: sql<number>`sum(${s.popupDaily.count})` })
            .from(s.popupDaily).innerJoin(s.popups, eq(s.popups.id, s.popupDaily.popup_id))
            .where(and(eq(s.popups.project_id, projectId), gte(s.popupDaily.day, from), lte(s.popupDaily.day, to)))
            .groupBy(s.popupDaily.popup_id, s.popupDaily.metric);
        return rows.map((r) => ({ ...r, count: Number(r.count) }));
    },

    // Retention cleanup (lib/retention.ts)
    /** Claims a maintenance job if it last ran before cutoffIso. True for exactly one caller per period. */
    async claimMaintenance(job: string, cutoffIso: string, nowIsoValue: string): Promise<boolean> {
        const d = await getDb();
        const r = await d.run(sql`INSERT INTO maintenance_runs (job, ran_at) VALUES (${job}, ${nowIsoValue})
            ON CONFLICT (job) DO UPDATE SET ran_at = excluded.ran_at WHERE maintenance_runs.ran_at < ${cutoffIso}`);
        return Number(r.rowsAffected) > 0;
    },

    async deleteOldHeatmapPoints(beforeIso: string, limit: number): Promise<number> {
        const d = await getDb();
        const r = await d.run(sql`DELETE FROM heatmap_points WHERE rowid IN (SELECT rowid FROM heatmap_points WHERE created_at < ${beforeIso} LIMIT ${limit})`);
        return Number(r.rowsAffected);
    },

    async deleteOldHeatmapScrolls(beforeIso: string, limit: number): Promise<number> {
        const d = await getDb();
        const r = await d.run(sql`DELETE FROM heatmap_scroll_points WHERE id IN (SELECT id FROM heatmap_scroll_points WHERE created_at < ${beforeIso} LIMIT ${limit})`);
        return Number(r.rowsAffected);
    },

    /** Survey answers older than the owning organization's plan retention. Unknown paid plans use the Starter cutoff. */
    async deleteOldSurveyAnswers(before: { free: string; starter: string; growth: string; enterprise: string }, limit: number): Promise<number> {
        const d = await getDb();
        const r = await d.run(sql`DELETE FROM survey_responses WHERE id IN (
            SELECT r.id FROM survey_responses r
            JOIN surveys sv ON sv.id = r.survey_id
            JOIN projects p ON p.id = sv.project_id
            JOIN organizations o ON o.id = p.org_id
            WHERE r.day < CASE lower(o.plan) WHEN 'free' THEN ${before.free} WHEN 'growth' THEN ${before.growth} WHEN 'enterprise' THEN ${before.enterprise} ELSE ${before.starter} END
            LIMIT ${limit})`);
        return Number(r.rowsAffected);
    },

    // Surveys (paid)
    async listSurveys(projectId: string) {
        const d = await getDb();
        return d.select().from(s.surveys).where(eq(s.surveys.project_id, projectId)).orderBy(desc(s.surveys.created_at));
    },

    async getSurvey(id: string) {
        const d = await getDb();
        return (await d.select().from(s.surveys).where(eq(s.surveys.id, id)))[0] ?? null;
    },

    async createSurvey(p: { project_id: string; name: string; status: 'draft' | 'active' | 'paused'; config: string }) {
        clearConfigCache();
        const d = await getDb();
        const id = generateId('srv');
        await d.insert(s.surveys).values({ id, ...p });
        return (await this.getSurvey(id))!;
    },

    async updateSurvey(id: string, update: { name?: string; status?: 'draft' | 'active' | 'paused'; config?: string }) {
        clearConfigCache();
        const d = await getDb();
        await d.update(s.surveys).set({ ...update, updated_at: nowIso() }).where(eq(s.surveys.id, id));
        return this.getSurvey(id);
    },

    async deleteSurvey(id: string): Promise<void> {
        clearConfigCache();
        const d = await getDb();
        await d.delete(s.surveys).where(eq(s.surveys.id, id));
    },

    /** Active surveys of a project for the SDK, cached briefly like popups. */
    async getActiveSurveys(projectId: string) {
        return cached(`srv:${projectId}`, async () => {
            const d = await getDb();
            return d.select().from(s.surveys).where(and(eq(s.surveys.project_id, projectId), eq(s.surveys.status, 'active')));
        });
    },

    async getSurveyStats(projectId: string, from: string, to: string) {
        const d = await getDb();
        const rows = await d.select({ survey_id: s.surveyDaily.survey_id, metric: s.surveyDaily.metric, count: sql<number>`sum(${s.surveyDaily.count})` })
            .from(s.surveyDaily).innerJoin(s.surveys, eq(s.surveys.id, s.surveyDaily.survey_id))
            .where(and(eq(s.surveys.project_id, projectId), gte(s.surveyDaily.day, from), lte(s.surveyDaily.day, to)))
            .groupBy(s.surveyDaily.survey_id, s.surveyDaily.metric);
        return rows.map((r) => ({ ...r, count: Number(r.count) }));
    },

    /** Kept answers per value for one survey between two UTC days. */
    async getSurveyAnswerCounts(surveyId: string, from: string, to: string) {
        const d = await getDb();
        const rows = await d.select({ answer: s.surveyResponses.answer, count: sql<number>`count(*)` }).from(s.surveyResponses)
            .where(and(eq(s.surveyResponses.survey_id, surveyId), gte(s.surveyResponses.day, from), lte(s.surveyResponses.day, to)))
            .groupBy(s.surveyResponses.answer);
        return rows.map((r) => ({ answer: r.answer, count: Number(r.count) }));
    },

    /** Newest answers first. Text questions list answers; others list answers that have a comment. */
    async getSurveyResponses(surveyId: string, from: string, to: string, opts: { limit: number; withCommentOnly?: boolean }) {
        const d = await getDb();
        const where = [eq(s.surveyResponses.survey_id, surveyId), gte(s.surveyResponses.day, from), lte(s.surveyResponses.day, to)];
        if (opts.withCommentOnly) where.push(sql`${s.surveyResponses.comment} IS NOT NULL`);
        return d.select({ created_at: s.surveyResponses.created_at, answer: s.surveyResponses.answer, comment: s.surveyResponses.comment, path: s.surveyResponses.path })
            .from(s.surveyResponses).where(and(...where)).orderBy(desc(s.surveyResponses.id)).limit(opts.limit);
    },

    /** JavaScript errors for one test between two UTC days (inclusive), summed per version and error. */
    async getErrors(experimentId: string, from: string, to: string) {
        const d = await getDb();
        const e = s.errorDaily;
        const rows = await d.select({
            variation_id: e.variation_id, fingerprint: e.fingerprint,
            kind: sql<string>`max(${e.kind})`, message: sql<string>`max(${e.message})`, source: sql<string>`max(${e.source})`, line: sql<number>`max(${e.line})`,
            count: sql<number>`sum(${e.count})`, last_seen: sql<string>`max(${e.day})`,
        }).from(e).where(and(eq(e.experiment_id, experimentId), gte(e.day, from), lte(e.day, to))).groupBy(e.variation_id, e.fingerprint);
        return rows.map((r) => ({ ...r, line: Number(r.line), count: Number(r.count) }));
    },

    /** Traffic overview: daily totals and per-key sums for one environment between two UTC days (inclusive). */
    async getTraffic(environmentId: string, from: string, to: string) {
        const d = await getDb();
        const range = and(eq(s.trafficDaily.environment_id, environmentId), gte(s.trafficDaily.day, from), lte(s.trafficDaily.day, to));
        const daily = await d.select({ day: s.trafficDaily.day, dim: s.trafficDaily.dim, key: s.trafficDaily.key, views: s.trafficDaily.views })
            .from(s.trafficDaily).where(and(range, inArray(s.trafficDaily.dim, ['views', 'entries', 'new_views'])));
        const grouped = await d.select({ dim: s.trafficDaily.dim, key: s.trafficDaily.key, views: sql<number>`sum(${s.trafficDaily.views})` })
            .from(s.trafficDaily).where(and(range, inArray(s.trafficDaily.dim, ['page', 'source', 'device', 'country'])))
            .groupBy(s.trafficDaily.dim, s.trafficDaily.key);
        return { daily: daily.map((r) => ({ ...r, views: Number(r.views) })), grouped: grouped.map((r) => ({ ...r, views: Number(r.views) })) };
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

/**
 * Page path counters are capped per environment per day: a path already counted that day, or one that still fits
 * under TRAFFIC_MAX_PAGES_PER_DAY, is upserted as usual; otherwise its views go to OTHER_PAGES. Both statements run
 * inside the same telemetry batch (one round trip), and the second only writes when the first skipped the row.
 */
function cappedPageUpsert(d: Awaited<ReturnType<typeof getDb>>, r: { day: string; environment_id: string; project_id: string; key: string; views: number }) {
    const same = sql`day = ${r.day} AND environment_id = ${r.environment_id} AND dim = 'page'`;
    return [
        d.run(sql`INSERT INTO traffic_daily (day, environment_id, project_id, dim, key, views)
            SELECT ${r.day}, ${r.environment_id}, ${r.project_id}, 'page', ${r.key}, ${r.views}
            WHERE EXISTS (SELECT 1 FROM traffic_daily WHERE ${same} AND key = ${r.key})
               OR (SELECT count(*) FROM traffic_daily WHERE ${same} AND key <> ${OTHER_PAGES}) < ${TRAFFIC_MAX_PAGES_PER_DAY}
            ON CONFLICT (day, environment_id, dim, key) DO UPDATE SET views = views + excluded.views`),
        d.run(sql`INSERT INTO traffic_daily (day, environment_id, project_id, dim, key, views)
            SELECT ${r.day}, ${r.environment_id}, ${r.project_id}, 'page', ${OTHER_PAGES}, ${r.views}
            WHERE NOT EXISTS (SELECT 1 FROM traffic_daily WHERE ${same} AND key = ${r.key})
            ON CONFLICT (day, environment_id, dim, key) DO UPDATE SET views = views + excluded.views`),
    ];
}

type ErrorUpsertRow = { day: string; experiment_id: string; variation_id: string; fingerprint: string; kind: string; message: string; source: string; line: number; count: number };

function plainErrorUpsert(d: Awaited<ReturnType<typeof getDb>>, r: ErrorUpsertRow) {
    return d.run(sql`INSERT INTO error_daily (day, experiment_id, variation_id, fingerprint, kind, message, source, line, count)
        VALUES (${r.day}, ${r.experiment_id}, ${r.variation_id}, ${r.fingerprint}, ${r.kind}, ${r.fingerprint === OTHER_ERRORS ? '' : r.message}, ${r.fingerprint === OTHER_ERRORS ? '' : r.source}, ${r.fingerprint === OTHER_ERRORS ? 0 : r.line}, ${r.count})
        ON CONFLICT (day, experiment_id, variation_id, fingerprint) DO UPDATE SET count = count + excluded.count`);
}

/**
 * Distinct errors are capped per test per day (all versions together): a known error, or a new one that still fits
 * under ERROR_MAX_PER_DAY, is upserted; otherwise it counts under OTHER_ERRORS. Same batch, no extra round trip.
 */
function cappedErrorUpsert(d: Awaited<ReturnType<typeof getDb>>, r: ErrorUpsertRow) {
    const known = sql`EXISTS (SELECT 1 FROM error_daily WHERE day = ${r.day} AND experiment_id = ${r.experiment_id} AND fingerprint = ${r.fingerprint})`;
    const distinct = sql`(SELECT count(DISTINCT fingerprint) FROM error_daily WHERE day = ${r.day} AND experiment_id = ${r.experiment_id} AND fingerprint NOT IN (${OTHER_ERRORS}, ${PAGES_WITH_ERRORS}))`;
    return [
        d.run(sql`INSERT INTO error_daily (day, experiment_id, variation_id, fingerprint, kind, message, source, line, count)
            SELECT ${r.day}, ${r.experiment_id}, ${r.variation_id}, ${r.fingerprint}, ${r.kind}, ${r.message}, ${r.source}, ${r.line}, ${r.count}
            WHERE ${known} OR ${distinct} < ${ERROR_MAX_PER_DAY}
            ON CONFLICT (day, experiment_id, variation_id, fingerprint) DO UPDATE SET count = count + excluded.count`),
        d.run(sql`INSERT INTO error_daily (day, experiment_id, variation_id, fingerprint, kind, message, source, line, count)
            SELECT ${r.day}, ${r.experiment_id}, ${r.variation_id}, ${OTHER_ERRORS}, 'other', '', '', 0, ${r.count}
            WHERE NOT ${known}
            ON CONFLICT (day, experiment_id, variation_id, fingerprint) DO UPDATE SET count = count + excluded.count`),
    ];
}
