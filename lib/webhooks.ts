import { after } from 'next/server';
import { createHmac, randomBytes } from 'node:crypto';
import { lookup } from 'node:dns/promises';
import { isIP, type LookupFunction } from 'node:net';
import { request as httpsRequest } from 'node:https';
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

function isPrivateV4(a: number, b: number): boolean {
    return a === 0 || a === 10 || a === 127 || a >= 224 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254)
        || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 192 && b === 0) || (a === 198 && (b === 18 || b === 19));
}

/** The 16 bytes of an IPv6 address (any notation, including a dotted IPv4 tail), or null if it is not valid. */
function ipv6Bytes(ip: string): number[] | null {
    let x = ip.toLowerCase().split('%')[0];
    const dotted = x.match(/^(.*:)(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
    if (dotted) {
        const o = dotted.slice(2).map(Number);
        if (o.some((n) => n > 255)) return null;
        x = `${dotted[1]}${((o[0] << 8) | o[1]).toString(16)}:${((o[2] << 8) | o[3]).toString(16)}`;
    }
    const halves = x.split('::');
    if (halves.length > 2) return null;
    const head = halves[0] ? halves[0].split(':') : [];
    const tail = halves.length === 2 && halves[1] ? halves[1].split(':') : [];
    const fill = halves.length === 2 ? 8 - head.length - tail.length : 0;
    if (fill < 0 || (halves.length === 1 && head.length !== 8)) return null;
    const groups = [...head, ...Array<string>(fill).fill('0'), ...tail];
    if (groups.length !== 8 || groups.some((g) => !/^[0-9a-f]{1,4}$/.test(g))) return null;
    return groups.flatMap((g) => [parseInt(g, 16) >> 8, parseInt(g, 16) & 255]);
}

/**
 * True for loopback, private, link-local, carrier-grade NAT, multicast and other non-public addresses.
 * IPv6 is parsed to bytes, so every spelling is judged the same. Addresses that carry an IPv4 address (mapped
 * ::ffff:a.b.c.d, the deprecated ::a.b.c.d, NAT64 64:ff9b::/96 and 6to4 2002::/16) are judged by that IPv4 address.
 * Of the rest, only global unicast (2000::/3) is public, minus the documentation and Teredo ranges.
 */
export function isPrivateAddress(ip: string): boolean {
    const v = isIP(ip);
    if (v === 4) {
        const [a, b] = ip.split('.').map(Number);
        return isPrivateV4(a, b);
    }
    if (v === 6) {
        const b = ipv6Bytes(ip);
        if (!b) return true;
        const zeros = (from: number, to: number) => b.slice(from, to).every((n) => n === 0);
        if (zeros(0, 10) && b[10] === 0xff && b[11] === 0xff) return isPrivateV4(b[12], b[13]);
        if (zeros(0, 12)) return b[12] === 0 && b[13] === 0 && b[14] === 0 && b[15] <= 1 ? true : isPrivateV4(b[12], b[13]);
        if (b[0] === 0x00 && b[1] === 0x64 && b[2] === 0xff && b[3] === 0x9b && zeros(4, 12)) return isPrivateV4(b[12], b[13]);
        if (b[0] === 0x20 && b[1] === 0x02) return isPrivateV4(b[2], b[3]);
        if ((b[0] & 0xe0) !== 0x20) return true;
        if (b[0] === 0x20 && b[1] === 0x01 && ((b[2] === 0x0d && b[3] === 0xb8) || (b[2] === 0 && b[3] === 0))) return true;
        return false;
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

/** The checked address a delivery connects to. */
export interface Pin { address: string; family: 4 | 6 }

/**
 * Resolves the host and refuses to send if any address is not public. Returns the address to connect to, so the
 * request goes to exactly the address that was checked (a second DNS answer cannot point it elsewhere).
 */
export async function checkHost(url: string, resolve: Resolver): Promise<{ error: string } | { pin: Pin }> {
    const host = new URL(url).hostname.replace(/^\[|\]$/g, '');
    const pinOf = (a: string): Pin => ({ address: a, family: isIP(a) === 6 ? 6 : 4 });
    if (isIP(host)) return isPrivateAddress(host) ? { error: 'The address is not public.' } : { pin: pinOf(host) };
    let addrs: string[];
    try { addrs = await resolve(host); } catch { return { error: 'The host name could not be found.' }; }
    addrs = addrs.filter((a) => isIP(a));
    if (!addrs.length) return { error: 'The host name could not be found.' };
    if (addrs.some(isPrivateAddress)) return { error: 'The host name points to a private address.' };
    return { pin: pinOf(addrs[0]) };
}

/** A DNS lookup that always answers with the pinned address, in both the single and the all-addresses form. */
export function pinnedLookup(pin: Pin): LookupFunction {
    return ((_host: string, opts: unknown, cb?: unknown) => {
        const done = (typeof opts === 'function' ? opts : cb) as (err: Error | null, a: unknown, f?: number) => void;
        const all = typeof opts === 'object' && opts !== null && (opts as { all?: boolean }).all;
        if (all) done(null, [{ address: pin.address, family: pin.family }]);
        else done(null, pin.address, pin.family);
    }) as LookupFunction;
}

/**
 * The real sender: an HTTPS POST that connects only to the pinned address. TLS still checks the certificate against
 * the host name in the URL (SNI and verification use the URL host). Redirects are never followed.
 */
export const pinnedFetch: Fetcher = (url, init, pin) => new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = httpsRequest({
        protocol: 'https:', hostname: u.hostname, port: u.port || 443, path: `${u.pathname}${u.search}`,
        method: init.method ?? 'POST', headers: init.headers as Record<string, string>,
        lookup: pinnedLookup(pin), signal: init.signal ?? undefined, agent: false,
    }, (res) => {
        res.resume();
        resolve({ status: res.statusCode ?? 0 });
    });
    req.on('error', reject);
    req.end(typeof init.body === 'string' ? init.body : undefined);
});

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

export type Fetcher = (url: string, init: RequestInit, pin: Pin) => Promise<{ status: number }>;

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
    const bad = webhookUrlError(hook.url);
    if (bad) return fail(null, bad);
    const host = await checkHost(hook.url, resolve);
    if ('error' in host) return fail(null, host.error);
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
        }, host.pin);
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
export async function deliverDueWebhooks(now = new Date(), fetcher: Fetcher = pinnedFetch, resolve: Resolver = dnsResolver) {
    const rows = await db.claimDueWebhookDeliveries(now.toISOString(), DELIVERY_BATCH);
    const out = { sent: 0, retry: 0, failed: 0 };
    for (let i = 0; i < rows.length; i += 5) {
        const res = await Promise.all(rows.slice(i, i + 5).map((r) => sendOne(r, now, fetcher, resolve)));
        for (const r of res) out[r]++;
    }
    return out;
}

/** Send test: queues a ping to one endpoint and sends it now. Returns the outcome. */
export async function sendTestPing(hook: { id: string; org_id: string }, now = new Date(), fetcher: Fetcher = pinnedFetch, resolve: Resolver = dnsResolver) {
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
export async function runWebhooks(now = new Date(), fetcher: Fetcher = pinnedFetch, resolve: Resolver = dnsResolver) {
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
