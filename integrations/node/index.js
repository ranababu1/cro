// FreeABTest server-side SDK for Node.js 18+. No dependencies.
// Keep the hashing in step with lib/assignment.ts in the app: tests/nodeSdk.test.ts checks they agree.
import { createHash } from 'node:crypto';

export const DEFAULT_API_URL = 'https://www.freeabtest.com';
const MAX_BATCH = 50;
const MAX_MEMO = 10000;
const USER_ID = /^[\x21-\x7e]{1,200}$/;

/** A number in [0, 1] from sha256("<experimentId>:<userId>"), the same as the app's assignment hash. */
export function hashUserToVariation(userId, experimentId) {
    const hex = createHash('sha256').update(`${experimentId}:${userId}`).digest('hex');
    return parseInt(hex.substring(0, 8), 16) / 0xffffffff;
}

/**
 * Picks a variation the way the server does for a visitor with no stored assignment:
 * traffic hash first, then the weight split over active (not paused, weight > 0) variations.
 * Returns null when the visitor is outside the traffic setting.
 */
export function pickVariation(userId, experiment) {
    const active = experiment.variations.filter((v) => !v.paused && v.weight > 0);
    if (active.length === 0 || experiment.traffic_allocation <= 0) return null;
    if (hashUserToVariation(userId, `traffic:${experiment.id}`) > experiment.traffic_allocation / 100) return null;
    const total = active.reduce((s, v) => s + v.weight, 0);
    const h = hashUserToVariation(userId, experiment.id);
    let cum = 0;
    for (const v of active) {
        cum += v.weight / total;
        if (h <= cum) return v;
    }
    return active[active.length - 1];
}

function notAssigned(experimentId, reason) {
    return { experimentId, variationId: null, variationName: null, variationUrl: null, assigned: false, ...(reason ? { reason } : {}) };
}

export class FreeABTestError extends Error {
    constructor(message, status, body) {
        super(message);
        this.name = 'FreeABTestError';
        this.status = status;
        this.body = body;
    }
}

export class FreeABTest {
    /**
     * @param {import('./index').FreeABTestOptions} options
     */
    constructor(options) {
        if (!options || typeof options.secretKey !== 'string' || !options.secretKey.startsWith('cro_sk_')) {
            throw new FreeABTestError('A secret key (cro_sk_...) is required', 0);
        }
        this.secretKey = options.secretKey;
        this.apiUrl = (options.apiUrl || DEFAULT_API_URL).replace(/\/+$/, '');
        this.fetch = options.fetch || globalThis.fetch;
        if (typeof this.fetch !== 'function') throw new FreeABTestError('No fetch available: use Node.js 18+ or pass options.fetch', 0);
        this.timeoutMs = options.timeoutMs ?? 5000;
        this.configTtlMs = options.configTtlMs;
        this.flushAt = Math.min(Math.max(options.flushAt ?? 20, 1), MAX_BATCH);
        this.flushIntervalMs = options.flushIntervalMs ?? 5000;
        this.onError = options.onError || (() => {});
        this.queue = [];
        this.inflight = new Set();
        this.exposed = new Set();
        this.decisions = new Map();
        this.config = null;
        this.configAt = 0;
        this.configPromise = null;
        this.timer = null;
        this.closed = false;
    }

    async request(method, path, body) {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), this.timeoutMs);
        try {
            const res = await this.fetch(`${this.apiUrl}${path}`, {
                method,
                headers: { Authorization: `Bearer ${this.secretKey}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
                body: body ? JSON.stringify(body) : undefined,
                signal: ctrl.signal,
            });
            const data = await res.json().catch(() => null);
            if (!res.ok && res.status !== 202) throw new FreeABTestError((data && data.error) || `HTTP ${res.status}`, res.status, data);
            return data;
        } finally {
            clearTimeout(t);
        }
    }

    /** Fetches running and rolled-out experiments, cached for the server's ttl_seconds (or configTtlMs). */
    async loadConfig(force = false) {
        const ttl = this.configTtlMs ?? (this.config ? this.config.ttl_seconds * 1000 : 60000);
        if (!force && this.config && Date.now() - this.configAt < ttl) return this.config;
        if (!this.configPromise) {
            this.configPromise = this.request('GET', '/api/server/config')
                .then((c) => { this.config = c; this.configAt = Date.now(); return c; })
                .finally(() => { this.configPromise = null; });
        }
        try {
            return await this.configPromise;
        } catch (err) {
            // Keep serving the last good config when a refresh fails.
            if (this.config) { this.onError(err); return this.config; }
            throw err;
        }
    }

    remember(experimentId, userId, variationId) {
        const k = `${experimentId}:${userId}`;
        this.decisions.delete(k);
        this.decisions.set(k, variationId);
        if (this.decisions.size > MAX_MEMO) this.decisions.delete(this.decisions.keys().next().value);
    }

    checkUser(userId) {
        if (typeof userId !== 'string' || !USER_ID.test(userId)) throw new FreeABTestError('userId must be 1 to 200 printable ASCII characters without spaces', 0);
    }

    /**
     * Asks the server (POST /api/server/assign). Sticky: a stored assignment always wins.
     * Queues an exposure for assigned visitors unless options.track is false.
     */
    async getVariation(experimentId, userId, options = {}) {
        this.checkUser(userId);
        const r = await this.request('POST', '/api/server/assign', { experiment_id: experimentId, user_id: userId });
        const out = r.variation_id
            ? { experimentId, variationId: r.variation_id, variationName: r.variation_name, variationUrl: r.variation_url ?? null, assigned: !!r.assigned, ...(r.reason ? { reason: r.reason } : {}) }
            : notAssigned(experimentId, r.reason);
        if (out.assigned) {
            this.remember(experimentId, userId, out.variationId);
            if (options.track !== false) this.trackExposure(experimentId, out.variationId, userId);
        }
        return out;
    }

    /**
     * Decides locally from the cached config with the same hash as the server: no request per visitor.
     * The first exposure stores the assignment on the server. Visitors the server already assigned keep
     * the stored variation there; locally the hash is used, so avoid changing weights during a test.
     */
    async decide(experimentId, userId, options = {}) {
        this.checkUser(userId);
        const config = await this.loadConfig();
        const exp = config.experiments.find((e) => e.id === experimentId);
        if (!exp) return notAssigned(experimentId, 'not_running');
        if (exp.rollout_variation_id) {
            const w = exp.variations.find((v) => v.id === exp.rollout_variation_id);
            if (w) return { experimentId, variationId: w.id, variationName: w.name, variationUrl: w.url, assigned: false, reason: 'rollout' };
        }
        const v = pickVariation(userId, exp);
        if (!v) return notAssigned(experimentId);
        this.remember(experimentId, userId, v.id);
        if (options.track !== false) this.trackExposure(experimentId, v.id, userId);
        return { experimentId, variationId: v.id, variationName: v.name, variationUrl: v.url, assigned: true };
    }

    /** Queues a page_view (exposure). Repeat exposures for the same visitor in this process are skipped. */
    trackExposure(experimentId, variationId, userId) {
        const k = `${experimentId}:${userId}`;
        if (this.exposed.has(k)) return;
        this.exposed.add(k);
        if (this.exposed.size > MAX_MEMO) this.exposed.delete(this.exposed.values().next().value);
        this.enqueue({ experiment_id: experimentId, variation_id: variationId, user_id: userId, event_type: 'page_view' });
    }

    /**
     * Queues a conversion. Without variationId, uses this process's last decision for the visitor,
     * then the local hash from the config. Conversions are counted once per visitor per goal.
     */
    async trackConversion(experimentId, userId, options = {}) {
        this.checkUser(userId);
        let variationId = options.variationId || this.decisions.get(`${experimentId}:${userId}`);
        if (!variationId) {
            const d = await this.decide(experimentId, userId, { track: false });
            if (!d.assigned) return false;
            variationId = d.variationId;
        }
        this.enqueue({
            experiment_id: experimentId,
            variation_id: variationId,
            user_id: userId,
            event_type: 'conversion',
            ...(options.goalId ? { goal_id: options.goalId } : {}),
            ...(options.eventName ? { event_name: options.eventName } : {}),
            ...(options.metadata ? { metadata: options.metadata } : {}),
        });
        return true;
    }

    enqueue(event) {
        if (this.closed) return;
        this.queue.push(event);
        if (this.queue.length >= this.flushAt) void this.flush();
        else if (!this.timer && this.flushIntervalMs > 0) {
            this.timer = setTimeout(() => { this.timer = null; void this.flush(); }, this.flushIntervalMs);
            if (typeof this.timer.unref === 'function') this.timer.unref();
        }
    }

    /**
     * Sends queued events in batches of up to 50 and waits for every batch still in flight, including
     * ones started automatically. Failed batches go to onError and are dropped.
     */
    async flush() {
        if (this.timer) { clearTimeout(this.timer); this.timer = null; }
        while (this.queue.length) {
            const events = this.queue.splice(0, MAX_BATCH);
            const p = this.request('POST', '/api/server/track', { events })
                .catch((err) => this.onError(err))
                .finally(() => this.inflight.delete(p));
            this.inflight.add(p);
        }
        await Promise.all([...this.inflight]);
    }

    /** Flushes and stops accepting events. Call it before the process exits. */
    async close() {
        await this.flush();
        this.closed = true;
    }
}

export default FreeABTest;
