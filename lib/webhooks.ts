import { after } from 'next/server';
import { createHmac, randomBytes } from 'node:crypto';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { db } from './db';
import { cached } from './configCache';
import { generateId } from './ids';
import { canUseFeature, getOrgEntitlements } from './entitlements';
import { buildExperimentResults } from './results';
import { getVisitorUsage } from './quotas';
import { getPageviewStatus } from './pageviewQuota';
import type { Experiment } from './types';

/**
 * Webhooks (paid). When something happens, one outbox row per subscribed endpoint is written (a dedupe key makes
 * each event fire once). No cron: busy routes call scheduleWebhooks(), and the maintenance job sends due rows in
 * small batches, at most once a minute across instances, with retries. Every 10 minutes it also checks running
 * tests for a winner or a sample ratio warning, and organizations for a reached plan limit.
 *
 * Each delivery is a JSON POST signed with the endpoint's secret:
 *   X-FreeABTest-Signature: t=<unix seconds>,v1=<hex HMAC-SHA256 of "<t>.<raw body>">
 */
export const WEBHOOK_EVENTS = ['test.winner', 'test.completed', 'test.srm_warning', 'quota.reached'] as const;
export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number] | 'ping';
export const EVENT_LABELS: Record<(typeof WEBHOOK_EVENTS)[number], string> = {
    'test.winner': 'A test found a winner',
    'test.completed': 'A test finished',
    'test.srm_warning': 'Sample ratio mismatch warning',
    'quota.reached': 'A plan limit was reached',
};
export const MAX_WEBHOOKS = 5;
/** Minutes to wait before each retry. After the last one the delivery is marked failed. */
export const RETRY_MINUTES = [1, 5, 30, 120, 720] as const;
export const MAX_ATTEMPTS = RETRY_MINUTES.length + 1;
export const DELIVERY_TIMEOUT_MS = 5000;
export const DELIVERY_BATCH = 10;
export const DELIVERY_RETENTION_DAYS = 30;
export const WEBHOOKS_JOB = 'webhooks';
export const WEBHOOKS_SCAN_JOB = 'webhooks_scan';
const DELIVER_EVERY_MS = 60_000;
const SCAN_EVERY_MS = 10 * 60_000;
const LOCAL_CHECK_MS = 30_000;
const APP_URL = (process.env.NEXTAUTH_URL || 'https://www.freeabtest.com').replace(/\/$/, '');

export const newWebhookSecret = () => `whsec_${randomBytes(24).toString('hex')}`;

export function signPayload(secret: string, t: number, body: string): string {
    return createHmac('sha256', secret).update(`${t}.${body}`).digest('hex');
}

export function parseEvents(raw: string | null | undefined): (typeof WEBHOOK_EVENTS)[number][] {
    try {
        const v = JSON.parse(raw || '[]');
        return Array.isArray(v) ? v.filter((e): e is (typeof WEBHOOK_EVENTS)[number] => (WEBHOOK_EVENTS as readonly string[]).includes(e)) : [];
    } catch {
        return [];
    }
}

/** True for loopback, private, link-local, carrier-grade NAT, multicast and other non-public addresses. */
export function isPrivateAddress(ip: string): boolean {
    const v = isIP(ip);
    if (v === 4) {
        const [a, b] = ip.split('.').map(Number);
        return a === 0 || a === 10 || a === 127 || a >= 224 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254)
            || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 192 && b === 0) || (a === 198 && (b === 18 || b === 19));
    }
    if (v === 6) {
        const x = ip.toLowerCase();
        const mapped = x.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
        if (mapped) return isPrivateAddress(mapped[1]);
        return x === '::' || x === '::1' || x.startsWith('fc') || x.startsWith('fd') || x.startsWith('fe8') || x.startsWith('fe9') || x.startsWith('fea') || x.startsWith('feb') || x.startsWith('ff');
    }
    return true;
}

/** Checks the address an owner enters: https, no credentials, and not an obviously internal host. Returns an error or null. */
export function webhookUrlError(raw: string): string | null {
    let u: URL;
    try { u = new URL(raw); } catch { return 'Enter a full URL, starting with https://'; }
    if (u.protocol !== 'https:') return 'The URL must start with https://';
    if (u.username || u.password) return 'Remove the user name and password from the URL.';
    const host = u.hostname.replace(/^\[|\]$/g, '').toLowerCase();
    if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal') || !host.includes('.') && !isIP(host)) return 'Use a public address. Local and internal hosts are not allowed.';
    if (isIP(host) && isPrivateAddress(host)) return 'Use a public address. Private IP addresses are not allowed.';
    if (raw.length > 500) return 'The URL is too long.';
    return null;
}

export type Resolver = (host: string) => Promise<string[]>;
const dnsResolver: Resolver = async (host) => (await lookup(host, { all: true, verbatim: true })).map((a) => a.address);

/** Resolves the host and refuses to send if any address is not public. */
async function publicHostError(url: string, resolve: Resolver): Promise<string | null> {
    const host = new URL(url).hostname.replace(/^\[|\]$/g, '');
    if (isIP(host)) return isPrivateAddress(host) ? 'The address is not public.' : null;
    let addrs: string[];
    try { addrs = await resolve(host); } catch { return 'The host name could not be found.'; }
    if (!addrs.length) return 'The host name could not be found.';
    return addrs.some(isPrivateAddress) ? 'The host name points to a private address.' : null;
}

/** An endpoint as the dashboard sees it: never the full secret. */
export const presentWebhook = (w: Awaited<ReturnType<typeof db.listWebhooks>>[number]) => ({
    id: w.id, url: w.url, events: parseEvents(w.events), enabled: w.enabled, created_at: w.created_at,
    last_delivery_at: w.last_delivery_at, last_status: w.last_status, last_error: w.last_error,
    // The full secret is shown once, when it is created or replaced.
    secret_hint: `${w.secret.slice(0, 10)}...${w.secret.slice(-4)}`,
});

const subscribed = (orgId: string) => cached(`wh:${orgId}`, async () => (await db.listWebhooks(orgId)).filter((w) => w.enabled));

/** Queues an event for every enabled endpoint of the org subscribed to it. Paid plans only. Returns rows queued. */
export async function emitWebhookEvent(orgId: string, event: (typeof WEBHOOK_EVENTS)[number], dedupeKey: string, data: Record<string, unknown>, now = new Date()): Promise<number> {
    const hooks = (await subscribed(orgId)).filter((w) => parseEvents(w.events).includes(event));
    if (!hooks.length || !(await canUseFeature(orgId, 'webhooks'))) return 0;
    const at = now.toISOString();
    const rows = hooks.map((w) => {
        const id = generateId('whd');
        return { id, webhook_id: w.id, org_id: orgId, event, dedupe_key: `${event}:${dedupeKey}`, payload: JSON.stringify({ id, event, created_at: at, data }), next_attempt_at: at };
    });
    const n = await db.enqueueWebhookDeliveries(rows);
    if (n) scheduleWebhooks();
    return n;
}

const experimentData = (e: Pick<Experiment, 'id' | 'name' | 'status' | 'control_url'>) => ({ experiment: { id: e.id, name: e.name, status: e.status, url: e.control_url, dashboard_url: `${APP_URL}/experiments/${e.id}` } });

/** Call after a test is completed by any route (manual, schedule, rollout). Never throws. */
export async function emitTestCompleted(orgId: string, e: Pick<Experiment, 'id' | 'name' | 'status' | 'control_url'>, how: 'manual' | 'schedule' | 'rollout'): Promise<void> {
    try {
        await emitWebhookEvent(orgId, 'test.completed', e.id, { ...experimentData({ ...e, status: 'completed' }), completed_by: how });
    } catch (err) {
        console.error('webhook enqueue failed', err);
    }
}

/** Checks running tests of orgs with webhooks for a winner or sample ratio warning, and the orgs for reached limits. */
export async function scanForWebhookEvents(now = new Date()): Promise<number> {
    let queued = 0;
    const month = now.toISOString().slice(0, 7);
    for (const orgId of await db.orgsWithWebhooks()) {
        if (!(await canUseFeature(orgId, 'webhooks'))) continue;
        const hooks = await subscribed(orgId);
        const wants = new Set(hooks.flatMap((w) => parseEvents(w.events)));
        if (wants.has('test.winner') || wants.has('test.srm_warning')) {
            const projects = await db.getOrgProjects(orgId);
            const running = (await db.getExperiments(projects.map((p) => p.id))).filter((e) => e.status === 'running').slice(0, 50);
            for (const e of running) {
                const r = await buildExperimentResults(e);
                if (wants.has('test.winner') && r.winner) {
                    const w = r.variations.find((v) => v.variation_id === r.winner);
                    queued += await emitWebhookEvent(orgId, 'test.winner', `${e.id}:${r.winner}`, { ...experimentData(e), winner: { variation_id: r.winner, name: w?.variation_name ?? null }, visitors: r.sample_size }, now);
                }
                if (wants.has('test.srm_warning') && r.srm?.mismatch) {
                    queued += await emitWebhookEvent(orgId, 'test.srm_warning', e.id, { ...experimentData(e), p_value: r.srm.p_value, variations: r.srm.variations }, now);
                }
            }
        }
        if (wants.has('quota.reached')) {
            const { limits } = await getOrgEntitlements(orgId);
            const v = await getVisitorUsage(orgId);
            if (limits.monthlyVisitors !== null && v.month >= limits.monthlyVisitors) {
                queued += await emitWebhookEvent(orgId, 'quota.reached', `visitors:${month}`, { limit: 'monthly_tested_visitors', used: v.month, max: limits.monthlyVisitors, month }, now);
            }
            const pv = await getPageviewStatus(orgId, { fresh: true });
            if (pv.paused && pv.limit !== null) {
                queued += await emitWebhookEvent(orgId, 'quota.reached', `pageviews:${month}`, { limit: 'monthly_pageviews', used: pv.used, max: pv.limit, month }, now);
            }
        }
    }
    return queued;
}

export type Fetcher = (url: string, init: RequestInit) => Promise<{ status: number }>;

/** Sends one claimed delivery and records the outcome, with a retry time on failure. */
async function sendOne(row: Awaited<ReturnType<typeof db.claimDueWebhookDeliveries>>[number], now: Date, fetcher: Fetcher, resolve: Resolver, once = false): Promise<'sent' | 'retry' | 'failed'> {
    const hook = await db.getWebhook(row.webhook_id);
    const attempts = row.attempts + 1;
    const fail = async (status: number | null, error: string, final = once || attempts >= MAX_ATTEMPTS) => {
        await db.finishWebhookDelivery(row.id, final
            ? { status: 'failed', attempts, response_status: status, last_error: error }
            : { status: 'pending', attempts, response_status: status, last_error: error, next_attempt_at: new Date(now.getTime() + RETRY_MINUTES[attempts - 1] * 60_000).toISOString() });
        if (hook) await db.updateWebhook(hook.id, { last_delivery_at: now.toISOString(), last_status: status, last_error: error });
        return final ? 'failed' as const : 'retry' as const;
    };
    if (!hook || !hook.enabled) return fail(null, 'The endpoint was turned off or deleted.', true);
    if (!(await canUseFeature(row.org_id, 'webhooks'))) return fail(null, 'Webhooks need a paid plan.', true);
    const bad = webhookUrlError(hook.url) ?? await publicHostError(hook.url, resolve);
    if (bad) return fail(null, bad);
    const t = Math.floor(now.getTime() / 1000);
    try {
        const res = await fetcher(hook.url, {
            method: 'POST',
            redirect: 'manual',
            signal: AbortSignal.timeout(DELIVERY_TIMEOUT_MS),
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'FreeABTest-Webhooks/1.0',
                'X-FreeABTest-Event': row.event,
                'X-FreeABTest-Delivery': row.id,
                'X-FreeABTest-Signature': `t=${t},v1=${signPayload(hook.secret, t, row.payload)}`,
            },
            body: row.payload,
        });
        if (res.status >= 200 && res.status < 300) {
            await db.finishWebhookDelivery(row.id, { status: 'sent', attempts, response_status: res.status, last_error: null, sent_at: now.toISOString() });
            await db.updateWebhook(hook.id, { last_delivery_at: now.toISOString(), last_status: res.status, last_error: null });
            return 'sent';
        }
        return fail(res.status, res.status >= 300 && res.status < 400 ? 'The endpoint answered with a redirect. Redirects are not followed.' : `The endpoint answered ${res.status}.`);
    } catch (err) {
        const timedOut = err instanceof Error && (err.name === 'TimeoutError' || err.name === 'AbortError');
        return fail(null, timedOut ? `No answer within ${DELIVERY_TIMEOUT_MS / 1000} seconds.` : 'Could not connect to the endpoint.');
    }
}

/** Sends due deliveries in one small batch, a few at a time. */
export async function deliverDueWebhooks(now = new Date(), fetcher: Fetcher = fetch, resolve: Resolver = dnsResolver) {
    const rows = await db.claimDueWebhookDeliveries(now.toISOString(), DELIVERY_BATCH);
    const out = { sent: 0, retry: 0, failed: 0 };
    for (let i = 0; i < rows.length; i += 5) {
        const res = await Promise.all(rows.slice(i, i + 5).map((r) => sendOne(r, now, fetcher, resolve)));
        for (const r of res) out[r]++;
    }
    return out;
}

/** Send test: queues a ping to one endpoint and sends it now. Returns the outcome. */
export async function sendTestPing(hook: { id: string; org_id: string }, now = new Date(), fetcher: Fetcher = fetch, resolve: Resolver = dnsResolver) {
    const id = generateId('whd');
    const at = now.toISOString();
    const payload = JSON.stringify({ id, event: 'ping', created_at: at, data: { message: 'Test delivery from freeabtest.com' } });
    await db.enqueueWebhookDeliveries([{ id, webhook_id: hook.id, org_id: hook.org_id, event: 'ping', dedupe_key: `ping:${id}`, payload, next_attempt_at: at }]);
    const row = await db.claimWebhookDelivery(id, at);
    if (!row) return 'failed' as const;
    // A test is sent once; a failure is shown at once rather than retried.
    return sendOne(row, now, fetcher, resolve, true);
}

/** The maintenance job: scan every 10 minutes, deliver every minute, across all instances. */
export async function runWebhooks(now = new Date(), fetcher: Fetcher = fetch, resolve: Resolver = dnsResolver) {
    const t = now.getTime();
    const scan = await db.claimMaintenance(WEBHOOKS_SCAN_JOB, new Date(t - SCAN_EVERY_MS).toISOString(), now.toISOString());
    const deliver = await db.claimMaintenance(WEBHOOKS_JOB, new Date(t - DELIVER_EVERY_MS).toISOString(), now.toISOString());
    if (scan) await scanForWebhookEvents(now);
    if (!scan && !deliver) return null;
    return deliverDueWebhooks(now, fetcher, resolve);
}

let lastLocalCheck = 0;

/** Cheap to call from busy routes; a due run happens after the response. */
export function scheduleWebhooks(now = Date.now()): void {
    if (now - lastLocalCheck < LOCAL_CHECK_MS) return;
    lastLocalCheck = now;
    const run = () => runWebhooks().then(() => undefined).catch((err) => console.error('webhook delivery failed', err));
    try { after(run); } catch { void run(); }
}

/** Tests only. */
export function resetWebhookThrottle(): void {
    lastLocalCheck = 0;
}
