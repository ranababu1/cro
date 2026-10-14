import { sqliteTable, text, integer, primaryKey, uniqueIndex, index, check } from 'drizzle-orm/sqlite-core';
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
    created_at: text('created_at').notNull().default(now),
}, (t) => [
    index('idx_variations_experiment').on(t.experiment_id),
    check('ck_variations_weight', sql`${t.weight} >= 0 AND ${t.weight} <= 100`),
]);


export const goals = sqliteTable('goals', {
    id: text('id').primaryKey(),
    experiment_id: text('experiment_id').notNull().references(() => experiments.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    selector: text('selector').notNull(), // CSS selector, e.g. #headerCTA or .bodyCTA
    is_primary: integer('is_primary', { mode: 'boolean' }).notNull().default(false),
    created_at: text('created_at').notNull().default(now),
}, (t) => [index('idx_goals_experiment').on(t.experiment_id)]);

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
    event_type: text('event_type', { enum: ['page_view', 'conversion'] }).notNull(),
    event_name: text('event_name'),
    goal_id: text('goal_id').references(() => goals.id, { onDelete: 'set null' }),
    metadata: text('metadata'),
    created_at: text('created_at').notNull().default(now),
}, (t) => [
    index('idx_events_experiment_type').on(t.experiment_id, t.event_type),
    index('idx_events_variation').on(t.variation_id),
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
