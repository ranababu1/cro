import { createHash } from 'node:crypto';
import { after } from 'next/server';
import { db } from './db';
import { generateId } from './ids';

/** Metric names stored in telemetry_daily. Keep stable for charts and CSV. */
export const METRICS = {
    signups: 'signups',
    logins: 'logins',
    active_users: 'active_users', // unique dashboard users active that day (approx via counters)
    tests_created: 'tests_created',
    tests_started: 'tests_started',
    tests_completed: 'tests_completed',
    domains_added: 'domains_added',
    variations_created: 'variations_created',
    sdk_assign: 'sdk_assign',
    sdk_exposure: 'sdk_exposure',
    sdk_goal: 'sdk_goal',
    sdk_bootstrap: 'sdk_bootstrap',
    unique_visitors: 'unique_visitors',
    conversions: 'conversions',
    api_key_requests: 'api_key_requests',
    errors: 'errors',
    rate_limit_hits: 'rate_limit_hits',
} as const;

export type MetricName = (typeof METRICS)[keyof typeof METRICS];
export type ScopeType = 'platform' | 'org' | 'user' | 'project' | 'experiment';

export function utcDay(d = new Date()): string {
    return d.toISOString().slice(0, 10);
}

/** Hash client IP for privacy. Never store raw IPs. */
export function hashIp(ip: string | null | undefined): string | null {
    if (!ip || ip === 'unknown') return null;
    const salt = process.env.TELEMETRY_IP_SALT || process.env.NEXTAUTH_SECRET || 'cro-telemetry';
    return createHash('sha256').update(`${salt}:${ip}`).digest('hex').slice(0, 32);
}

export function clientIpFromHeaders(headers: Headers): string {
    return headers.get('x-forwarded-for')?.split(',')[0].trim() || headers.get('x-real-ip') || 'unknown';
}

interface BumpOpts {
    orgId?: string | null;
    userId?: string | null;
    projectId?: string | null;
    experimentId?: string | null;
    day?: string;
    by?: number;
}

/**
 * Counter increments are buffered in memory and written in one batch: after the response is sent
 * (Next.js after()) or, outside a request, within FLUSH_MS. Repeated bumps of the same row merge
 * into one upsert. Set TELEMETRY_SYNC=1 to write immediately (tests).
 */
const FLUSH_MS = 2000;
type Row = { day: string; scope_type: ScopeType; scope_id: string; metric: string; value: number };
const buffer = new Map<string, Row>();
let timer: ReturnType<typeof setTimeout> | null = null;
let scheduledAfter = false;

/** Traffic overview counters (paid). Flushed in the same batch as telemetry, so no extra round trip. */
type TrafficBufRow = { day: string; environment_id: string; project_id: string; dim: string; key: string; views: number };
const trafficBuffer = new Map<string, TrafficBufRow>();

export function pendingTelemetry(): number {
    return buffer.size + trafficBuffer.size;
}

export async function flushTelemetry(): Promise<void> {
    scheduledAfter = false;
    if (timer) { clearTimeout(timer); timer = null; }
    if (!buffer.size && !trafficBuffer.size) return;
    const rows = [...buffer.values()];
    const traffic = [...trafficBuffer.values()];
    buffer.clear();
    trafficBuffer.clear();
    try {
        await db.bumpTelemetryBatch(rows, traffic);
    } catch (err) {
        console.error('telemetry flush failed', err);
    }
}

function scheduleFlush(): void {
    if (!scheduledAfter) {
        try {
            after(flushTelemetry);
            scheduledAfter = true;
            return;
        } catch {
            // Not inside a request: fall back to a timer.
        }
    }
    if (!timer && !scheduledAfter) {
        timer = setTimeout(() => { timer = null; void flushTelemetry(); }, FLUSH_MS);
        (timer as { unref?: () => void }).unref?.();
    }
}

/** Increment daily counters for platform and optional org/user/project/experiment scopes. */
export async function bumpMetric(metric: MetricName, opts: BumpOpts = {}): Promise<void> {
    const day = opts.day ?? utcDay();
    const by = opts.by ?? 1;
    const scopes: Array<{ type: ScopeType; id: string }> = [{ type: 'platform', id: 'platform' }];
    if (opts.orgId) scopes.push({ type: 'org', id: opts.orgId });
    if (opts.userId) scopes.push({ type: 'user', id: opts.userId });
    if (opts.projectId) scopes.push({ type: 'project', id: opts.projectId });
    if (opts.experimentId) scopes.push({ type: 'experiment', id: opts.experimentId });
    for (const sc of scopes) {
        const key = `${day}|${sc.type}|${sc.id}|${metric}`;
        const cur = buffer.get(key);
        if (cur) cur.value += by;
        else buffer.set(key, { day, scope_type: sc.type, scope_id: sc.id, metric, value: by });
    }
    if (process.env.TELEMETRY_SYNC === '1') return flushTelemetry();
    scheduleFlush();
}

/** Adds one page view to the traffic overview counters for an environment. */
export async function bumpTraffic(scope: { environmentId: string; projectId: string }, dims: Array<{ dim: string; key: string }>, day = utcDay()): Promise<void> {
    for (const { dim, key } of dims) {
        const k = `${day}|${scope.environmentId}|${dim}|${key}`;
        const cur = trafficBuffer.get(k);
        if (cur) cur.views += 1;
        else trafficBuffer.set(k, { day, environment_id: scope.environmentId, project_id: scope.projectId, dim, key, views: 1 });
    }
    if (process.env.TELEMETRY_SYNC === '1') return flushTelemetry();
    scheduleFlush();
}

interface ProductEventInput {
    action: string;
    userId?: string | null;
    orgId?: string | null;
    projectId?: string | null;
    experimentId?: string | null;
    meta?: Record<string, unknown> | null;
    ip?: string | null;
}

/** Record a dashboard / product-usage event (not visitor page views). */
export async function recordProductEvent(input: ProductEventInput): Promise<void> {
    await db.createProductEvent({
        id: generateId('pev'),
        user_id: input.userId ?? null,
        org_id: input.orgId ?? null,
        project_id: input.projectId ?? null,
        experiment_id: input.experimentId ?? null,
        action: input.action,
        meta: input.meta ? JSON.stringify(input.meta) : null,
        ip_hash: hashIp(input.ip),
    });
}

export async function touchUserActivity(userId: string, kind: 'login' | 'active' = 'active'): Promise<void> {
    await db.touchUserActivity(userId, kind);
    if (kind === 'login') await bumpMetric(METRICS.logins, { userId });
    else await bumpMetric(METRICS.active_users, { userId });
}
