import { sqliteTable, text, integer, real, primaryKey, uniqueIndex, index, check } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

// SQLite schema (libSQL). Kept to portable column types so it can be ported to Postgres with drizzle-orm/pg-core.
// Timestamps are ISO 8601 strings in UTC.

const now = sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`;

export const users = sqliteTable('users', {
    id: text('id').primaryKey(),
    email: text('email').notNull().unique(),
    name: text('name').notNull(),
    image: text('image'),
    created_at: text('created_at').notNull().default(now),
    last_active_at: text('last_active_at'),
    last_login_at: text('last_login_at'),
    // Profile (onboarding and Settings > Profile). first_name, last_name and country are required to create or start tests.
    first_name: text('first_name'),
    last_name: text('last_name'),
    country: text('country'),
    phone: text('phone'),
    company: text('company'),
    job_role: text('job_role'),
    company_size: text('company_size'),
    heard_from: text('heard_from'),
    primary_goal: text('primary_goal'),
    marketing_opt_in: integer('marketing_opt_in', { mode: 'boolean' }).notNull().default(false),
    profile_completed_at: text('profile_completed_at'),
    // Set for users who sign up after onboarding shipped; they see /onboarding before the dashboard.
    onboarding_pending: integer('onboarding_pending', { mode: 'boolean' }).notNull().default(false),
    profile_prompt_dismissed_at: text('profile_prompt_dismissed_at'),
});

export const organizations = sqliteTable('organizations', {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    slug: text('slug').notNull().unique(),
    // Platform-level tenant controls, editable only by platform admins.
    status: text('status', { enum: ['active', 'suspended'] }).notNull().default('active'),
    suspended_at: text('suspended_at'),
    suspended_reason: text('suspended_reason'),
    plan: text('plan').notNull().default('free'),
    // null means unlimited
    monthly_visitor_limit: integer('monthly_visitor_limit'),
    monthly_experiment_limit: integer('monthly_experiment_limit'),
    // Tracked pageviews per month. null = plan default, -1 = unlimited. See lib/pageviewQuota.ts.
    monthly_pageview_limit: integer('monthly_pageview_limit'),
    // Special friend: custom allowances (JSON, see lib/allowances.ts) override the plan. Admin only, never shown to tenants.
    // Experiments ever started in this org. Never decreases, so deleting tests does not reset the free lifetime limit.
    experiments_started_total: integer('experiments_started_total').notNull().default(0),
    special_friend: integer('special_friend', { mode: 'boolean' }).notNull().default(false),
    custom_allowances: text('custom_allowances'),
    created_at: text('created_at').notNull().default(now),
});

export const memberships = sqliteTable('memberships', {
    org_id: text('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
    user_id: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    role: text('role', { enum: ['owner', 'member'] }).notNull().default('member'),
    created_at: text('created_at').notNull().default(now),
}, (t) => [primaryKey({ columns: [t.org_id, t.user_id] }), index('idx_memberships_user').on(t.user_id)]);

export const projects = sqliteTable('projects', {
    id: text('id').primaryKey(),
    org_id: text('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    created_at: text('created_at').notNull().default(now),
}, (t) => [index('idx_projects_org').on(t.org_id)]);

export const projectDomains = sqliteTable('project_domains', {
    id: text('id').primaryKey(),
    project_id: text('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
    host: text('host').notNull(), // lowercase hostname, no port, e.g. example.com or www.example.com
    created_at: text('created_at').notNull().default(now),
}, (t) => [uniqueIndex('uq_project_domains_host').on(t.project_id, t.host), index('idx_project_domains_project').on(t.project_id)]);

export const ENVIRONMENT_KEYS = ['dev', 'staging', 'prod'] as const;
export type EnvironmentKey = (typeof ENVIRONMENT_KEYS)[number];

export const environments = sqliteTable('environments', {
    id: text('id').primaryKey(),
    project_id: text('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
    key: text('key', { enum: ENVIRONMENT_KEYS }).notNull(),
    name: text('name').notNull(),
    created_at: text('created_at').notNull().default(now),
}, (t) => [uniqueIndex('uq_environments_project_key').on(t.project_id, t.key)]);

export const apiKeys = sqliteTable('api_keys', {
    id: text('id').primaryKey(),
    environment_id: text('environment_id').notNull().references(() => environments.id, { onDelete: 'cascade' }),
    type: text('type', { enum: ['sdk', 'secret'] }).notNull(),
    key_hash: text('key_hash').notNull().unique(),
    prefix: text('prefix').notNull(),
    // Public SDK keys are stored so install snippets can be pre-filled. Secret keys stay hash-only (null).
    key_plaintext: text('key_plaintext'),
    label: text('label'),
    created_by: text('created_by').references(() => users.id, { onDelete: 'set null' }),
    created_at: text('created_at').notNull().default(now),
    last_used_at: text('last_used_at'),
    revoked_at: text('revoked_at'),
}, (t) => [index('idx_api_keys_environment').on(t.environment_id)]);

export const experiments = sqliteTable('experiments', {
    id: text('id').primaryKey(),
    project_id: text('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
    user_id: text('user_id').notNull().references(() => users.id),
    name: text('name').notNull(),
    description: text('description'),
    status: text('status', { enum: ['draft', 'running', 'paused', 'completed'] }).notNull().default('draft'),
    control_url: text('control_url'),
    traffic_allocation: integer('traffic_allocation').notNull().default(100),
    targeting: text('targeting'), // JSON audience rules, see lib/targeting.ts. null = everyone
    // Auto-shift traffic to the winner (Growth+): weights are rewritten from Thompson sampling, see lib/autoShift.ts.
    auto_shift: integer('auto_shift', { mode: 'boolean' }).notNull().default(false),
    auto_shift_at: text('auto_shift_at'), // last time the weights were checked or rewritten
    created_at: text('created_at').notNull().default(now),
    updated_at: text('updated_at').notNull().default(now),
    started_at: text('started_at'),
    ended_at: text('ended_at'),
}, (t) => [
    index('idx_experiments_project').on(t.project_id),
    index('idx_experiments_status').on(t.status),
    check('ck_experiments_traffic', sql`${t.traffic_allocation} >= 0 AND ${t.traffic_allocation} <= 100`),
]);

export const variations = sqliteTable('variations', {
    id: text('id').primaryKey(),
    experiment_id: text('experiment_id').notNull().references(() => experiments.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    description: text('description'),
    url: text('url'),
    weight: integer('weight').notNull(),
    is_control: integer('is_control', { mode: 'boolean' }).notNull().default(false),
    // Paused variations get no new visitors. Visitors already assigned keep their version.
    paused: integer('paused', { mode: 'boolean' }).notNull().default(false),
    created_at: text('created_at').notNull().default(now),
}, (t) => [
    index('idx_variations_experiment').on(t.experiment_id),
    check('ck_variations_weight', sql`${t.weight} >= 0 AND ${t.weight} <= 100`),
]);


export const goals = sqliteTable('goals', {
    id: text('id').primaryKey(),
    experiment_id: text('experiment_id').notNull().references(() => experiments.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    // Target: CSS selector (click, form), URL pattern (page) or event name (event). See lib/goals.ts.
    selector: text('selector').notNull(),
    type: text('type', { enum: ['click', 'form', 'page', 'event'] }).notNull().default('click'),
    match_type: text('match_type', { enum: ['equals', 'contains', 'regex'] }),
    is_primary: integer('is_primary', { mode: 'boolean' }).notNull().default(false),
    // Display and evaluation order, 0-based. Set on create and by reorder.
    position: integer('position').notNull().default(0),
    created_at: text('created_at').notNull().default(now),
}, (t) => [index('idx_goals_experiment').on(t.experiment_id), index('idx_goals_experiment_position').on(t.experiment_id, t.position)]);

export const assignments = sqliteTable('assignments', {
    id: text('id').primaryKey(),
    experiment_id: text('experiment_id').notNull().references(() => experiments.id, { onDelete: 'cascade' }),
    variation_id: text('variation_id').notNull().references(() => variations.id, { onDelete: 'cascade' }),
    environment_id: text('environment_id').references(() => environments.id, { onDelete: 'cascade' }),
    user_id: text('user_id').notNull(),
    assigned_at: text('assigned_at').notNull().default(now),
}, (t) => [uniqueIndex('uq_assignments_experiment_user').on(t.experiment_id, t.user_id)]);

export const events = sqliteTable('events', {
    id: text('id').primaryKey(),
    experiment_id: text('experiment_id').notNull().references(() => experiments.id, { onDelete: 'cascade' }),
    variation_id: text('variation_id').notNull().references(() => variations.id, { onDelete: 'cascade' }),
    environment_id: text('environment_id').references(() => environments.id, { onDelete: 'cascade' }),
    user_id: text('user_id').notNull(),
    event_type: text('event_type', { enum: ['page_view', 'conversion', 'redirect'] }).notNull(),
    event_name: text('event_name'),
    goal_id: text('goal_id').references(() => goals.id, { onDelete: 'set null' }),
    metadata: text('metadata'),
    // Order value for revenue goals (custom events sent with a revenue amount, paid plans). Null otherwise.
    revenue: real('revenue'),
    created_at: text('created_at').notNull().default(now),
}, (t) => [
    index('idx_events_experiment_type').on(t.experiment_id, t.event_type),
    index('idx_events_variation').on(t.variation_id),
    index('idx_events_experiment_user').on(t.experiment_id, t.user_id, t.created_at),
    index('idx_events_experiment_created').on(t.experiment_id, t.created_at),
]);

export const auditLog = sqliteTable('audit_log', {
    id: text('id').primaryKey(),
    org_id: text('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
    actor_id: text('actor_id'),
    entity: text('entity').notNull(),
    entity_id: text('entity_id').notNull(),
    action: text('action').notNull(),
    diff: text('diff'),
    created_at: text('created_at').notNull().default(now),
}, (t) => [index('idx_audit_org_created').on(t.org_id, t.created_at)]);

/** Daily aggregated platform telemetry counters. scope_type+scope_id identify platform/org/user/project/experiment. */
export const telemetryDaily = sqliteTable('telemetry_daily', {
    day: text('day').notNull(), // YYYY-MM-DD UTC
    scope_type: text('scope_type', { enum: ['platform', 'org', 'user', 'project', 'experiment'] }).notNull(),
    scope_id: text('scope_id').notNull(), // 'platform' for platform scope
    metric: text('metric').notNull(),
    value: integer('value').notNull().default(0),
}, (t) => [
    primaryKey({ columns: [t.day, t.scope_type, t.scope_id, t.metric] }),
    index('idx_telemetry_daily_scope').on(t.scope_type, t.scope_id, t.day),
    index('idx_telemetry_daily_metric').on(t.metric, t.day),
]);

/**
 * Traffic overview (paid): daily page view totals per environment and dimension, written in the
 * same batched flush as telemetry. dim: views | entries | new_views (key '') or page | source | device | country.
 */
export const trafficDaily = sqliteTable('traffic_daily', {
    day: text('day').notNull(),
    environment_id: text('environment_id').notNull().references(() => environments.id, { onDelete: 'cascade' }),
    project_id: text('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
    dim: text('dim').notNull(),
    key: text('key').notNull(),
    views: integer('views').notNull().default(0),
}, (t) => [
    primaryKey({ columns: [t.day, t.environment_id, t.dim, t.key] }),
    index('idx_traffic_daily_env_dim').on(t.environment_id, t.dim, t.day),
]);

/** Server-side product usage events for dashboard actions (not visitor page views). */
export const productEvents = sqliteTable('product_events', {
    id: text('id').primaryKey(),
    occurred_at: text('occurred_at').notNull().default(now),
    user_id: text('user_id'),
    org_id: text('org_id'),
    project_id: text('project_id'),
    experiment_id: text('experiment_id'),
    action: text('action').notNull(), // e.g. experiment.create, domain.add, dashboard.view
    meta: text('meta'), // JSON, no visitor PII
    ip_hash: text('ip_hash'), // sha256 of IP + salt, never raw IP
}, (t) => [
    index('idx_product_events_occurred').on(t.occurred_at),
    index('idx_product_events_action').on(t.action, t.occurred_at),
    index('idx_product_events_user').on(t.user_id, t.occurred_at),
    index('idx_product_events_org').on(t.org_id, t.occurred_at),
]);

/** Read-only public links to an experiment's results. Revoking sets revoked_at. */
export const shareLinks = sqliteTable('share_links', {
    id: text('id').primaryKey(),
    experiment_id: text('experiment_id').notNull().references(() => experiments.id, { onDelete: 'cascade' }),
    token: text('token').notNull(), // random, 32 bytes base64url; grants read-only access to results only
    created_by: text('created_by').references(() => users.id, { onDelete: 'set null' }),
    created_at: text('created_at').notNull().default(now),
    revoked_at: text('revoked_at'),
}, (t) => [uniqueIndex('uq_share_links_token').on(t.token), index('idx_share_links_experiment').on(t.experiment_id)]);

/** Monthly usage counters per organization (month = YYYY-MM UTC). Cheap to read for quota checks. */
export const usageMonthly = sqliteTable('usage_monthly', {
    org_id: text('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
    month: text('month').notNull(),
    pageviews: integer('pageviews').notNull().default(0),
    // Distinct visitors enrolled this month, kept in step with org_visitors_monthly.
    visitors: integer('visitors').notNull().default(0),
}, (t) => [primaryKey({ columns: [t.org_id, t.month] })]);

/** New tested visitors per org per UTC day (daily cap). */
export const usageDaily = sqliteTable('usage_daily', {
    org_id: text('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
    day: text('day').notNull(),
    visitors: integer('visitors').notNull().default(0),
}, (t) => [primaryKey({ columns: [t.org_id, t.day] })]);

/** One row per visitor per org per month. Inserting tells us whether the visitor is new this month. */
export const orgVisitorsMonthly = sqliteTable('org_visitors_monthly', {
    org_id: text('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
    month: text('month').notNull(),
    user_id: text('user_id').notNull(),
}, (t) => [primaryKey({ columns: [t.org_id, t.month, t.user_id] })]);

/**
 * Daily results rollups for closed UTC days. scope is an environment id or '*' for all environments.
 * bucket: 'v' any event, 't:<event_type>', 'g:<goal_id>' (conversions), 'd' distinct users that day.
 * For v, t and g buckets, users counts visitors first seen in that bucket on that day, so sums over days are exact distinct counts.
 */
export const experimentStatsDaily = sqliteTable('experiment_stats_daily', {
    experiment_id: text('experiment_id').notNull().references(() => experiments.id, { onDelete: 'cascade' }),
    scope: text('scope').notNull(),
    variation_id: text('variation_id').notNull(),
    day: text('day').notNull(),
    bucket: text('bucket').notNull(),
    users: integer('users').notNull().default(0),
    events: integer('events').notNull().default(0),
}, (t) => [primaryKey({ columns: [t.experiment_id, t.scope, t.variation_id, t.day, t.bucket] })]);

export const rollupState = sqliteTable('rollup_state', {
    experiment_id: text('experiment_id').primaryKey().references(() => experiments.id, { onDelete: 'cascade' }),
    rolled_through: text('rolled_through').notNull(),
});

/**
 * Free-tier usage per registrable domain (eTLD+1), across all orgs. Survives org and domain deletion.
 * org_id is the free org currently holding the domain (null when released). experiments_used never decreases.
 */
export const domainLedger = sqliteTable('domain_ledger', {
    domain: text('domain').primaryKey(),
    org_id: text('org_id').references(() => organizations.id, { onDelete: 'set null' }),
    claimed_at: text('claimed_at'),
    experiments_used: integer('experiments_used').notNull().default(0),
    updated_at: text('updated_at').notNull().default(now),
}, (t) => [index('idx_domain_ledger_org').on(t.org_id)]);

// Heatmaps (paid plans). Raw points are kept 30 days for confetti; reports read the daily rollups.
export const heatmapPoints = sqliteTable('heatmap_points', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    org_id: text('org_id').notNull(),
    experiment_id: text('experiment_id').notNull().references(() => experiments.id, { onDelete: 'cascade' }),
    variation_id: text('variation_id').notNull(),
    device: text('device', { enum: ['desktop', 'tablet', 'mobile'] }).notNull(),
    x: integer('x').notNull(), // 0-1000, share of page width
    y: integer('y').notNull(), // px from the top of the page
    selector: text('selector').notNull(),
    rage: integer('rage', { mode: 'boolean' }).notNull().default(false),
    dead: integer('dead', { mode: 'boolean' }).notNull().default(false),
    created_at: text('created_at').notNull().default(now),
}, (t) => [index('idx_heatmap_points_exp').on(t.experiment_id, t.variation_id, t.device), index('idx_heatmap_points_created').on(t.created_at)]);

export const heatmapClicksDaily = sqliteTable('heatmap_clicks_daily', {
    experiment_id: text('experiment_id').notNull().references(() => experiments.id, { onDelete: 'cascade' }),
    variation_id: text('variation_id').notNull(),
    device: text('device').notNull(),
    day: text('day').notNull(),
    gx: integer('gx').notNull(), // 0-49, 2% columns
    gy: integer('gy').notNull(), // 25px rows
    selector: text('selector').notNull(),
    clicks: integer('clicks').notNull().default(0),
    rage: integer('rage').notNull().default(0),
    dead: integer('dead').notNull().default(0),
}, (t) => [primaryKey({ columns: [t.experiment_id, t.variation_id, t.device, t.day, t.gx, t.gy, t.selector] })]);

export const heatmapScrollDaily = sqliteTable('heatmap_scroll_daily', {
    experiment_id: text('experiment_id').notNull().references(() => experiments.id, { onDelete: 'cascade' }),
    variation_id: text('variation_id').notNull(),
    device: text('device').notNull(),
    day: text('day').notNull(),
    depth: integer('depth').notNull(), // max depth reached, 0-100 in steps of 10
    sessions: integer('sessions').notNull().default(0),
}, (t) => [primaryKey({ columns: [t.experiment_id, t.variation_id, t.device, t.day, t.depth] })]);

// Paid-only plugin downloads. One row per zip served, so admins can see who downloaded and leaks can be traced.
export const pluginDownloads = sqliteTable('plugin_downloads', {
    id: text('id').primaryKey(),
    plugin: text('plugin').notNull(), // 'wordpress'
    version: text('version').notNull(),
    org_id: text('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
    user_id: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    ip_hash: text('ip_hash'),
    created_at: text('created_at').notNull().default(now),
}, (t) => [index('idx_plugin_downloads_user').on(t.user_id, t.created_at), index('idx_plugin_downloads_org').on(t.org_id, t.created_at), index('idx_plugin_downloads_created').on(t.created_at)]);

// Funnels (paid plans): an ordered list of an experiment's goals. Numbers are computed from conversion events.
export const funnels = sqliteTable('funnels', {
    id: text('id').primaryKey(),
    experiment_id: text('experiment_id').notNull().references(() => experiments.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    steps: text('steps').notNull(), // JSON array of goal ids, in order
    created_at: text('created_at').notNull().default(now),
}, (t) => [index('idx_funnels_experiment').on(t.experiment_id)]);
