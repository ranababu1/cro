/**
 * Fixed-window rate limiter kept in process memory.
 * On its own it counts per server instance; SharedRateLimiter below wraps it with a shared store so limits hold across
 * instances. Memory is bounded: at most maxKeys windows are kept.
 */
export interface RateLimitResult {
    allowed: boolean;
    remaining: number;
    retryAfterSeconds: number;
}

export class RateLimiter {
    private windows = new Map<string, { start: number; count: number }>();

    constructor(
        private readonly limit: number,
        private readonly windowMs: number,
        private readonly now: () => number = Date.now,
        /** Most keys kept at once. Beyond it the oldest are forgotten, so made-up keys cannot grow memory without end. */
        private readonly maxKeys: number = 50_000,
    ) {}

    get size(): number {
        return this.windows.size;
    }

    /** True when the key is already over its limit in the current window. Looks only, never counts. */
    exceeded(key: string): boolean {
        const w = this.windows.get(key);
        return !!w && this.now() - w.start < this.windowMs && w.count > this.limit;
    }

    check(key: string): RateLimitResult {
        const t = this.now();
        let w = this.windows.get(key);
        if (!w || t - w.start >= this.windowMs) {
            w = { start: t, count: 0 };
            this.windows.set(key, w);
            if (this.windows.size > Math.min(10_000, this.maxKeys)) this.sweep(t);
            // Maps keep insertion order, so the first keys are the oldest windows.
            for (const k of this.windows.keys()) {
                if (this.windows.size <= this.maxKeys) break;
                this.windows.delete(k);
            }
        }
        w.count++;
        const allowed = w.count <= this.limit;
        return {
            allowed,
            remaining: Math.max(0, this.limit - w.count),
            retryAfterSeconds: allowed ? 0 : Math.ceil((w.start + this.windowMs - t) / 1000),
        };
    }

    private sweep(t: number): void {
        for (const [k, w] of this.windows) {
            if (t - w.start >= this.windowMs) this.windows.delete(k);
        }
    }
}

/** Anything that can rate limit: the in-memory RateLimiter, or the shared one below. */
export interface Limiter {
    check(key: string): RateLimitResult | Promise<RateLimitResult>;
    exceeded(key: string): boolean | Promise<boolean>;
}

type Fetcher = (url: string, init: { method: string; headers: Record<string, string>; body?: string; signal?: AbortSignal }) => Promise<{ ok: boolean; json(): Promise<unknown> }>;

/** Upstash Redis REST settings, when both UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are set. */
export function sharedStoreConfig(env: Record<string, string | undefined> = process.env): { url: string; token: string } | null {
    const url = env.UPSTASH_REDIS_REST_URL?.trim().replace(/\/$/, '');
    const token = env.UPSTASH_REDIS_REST_TOKEN?.trim();
    return url && token && /^https:\/\//.test(url) ? { url, token } : null;
}

const SHARED_TIMEOUT_MS = 250;

/**
 * Rate limiter shared by every server through Upstash Redis (REST, no client library): one fixed window per key,
 * counted with INCR on a key that names the window, so all instances agree. The local limiter answers first, so a key
 * that is already over its limit here costs no network call. Without the store settings, or when the store is slow
 * or down, it falls back to the local limiter (fail open), so an outage of the store never blocks real traffic.
 */
export class SharedRateLimiter implements Limiter {
    constructor(
        private readonly name: string,
        private readonly limit: number,
        private readonly windowMs: number,
        readonly local: RateLimiter = new RateLimiter(limit, windowMs),
        private readonly store: { url: string; token: string } | null = sharedStoreConfig(),
        private readonly fetcher: Fetcher = fetch as unknown as Fetcher,
        private readonly now: () => number = Date.now,
    ) {}

    get shared(): boolean {
        return this.store !== null;
    }

    private windowKey(key: string, t: number): { k: string; end: number } {
        const n = Math.floor(t / this.windowMs);
        return { k: `rl:${this.name}:${key}:${n}`, end: (n + 1) * this.windowMs };
    }

    private async call(commands: (string | number)[][]): Promise<unknown[]> {
        const res = await this.fetcher(`${this.store!.url}/pipeline`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${this.store!.token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(commands),
            signal: AbortSignal.timeout(SHARED_TIMEOUT_MS),
        });
        if (!res.ok) throw new Error('rate limit store error');
        const out = (await res.json()) as Array<{ result?: unknown; error?: string }>;
        if (!Array.isArray(out) || out.some((r) => r?.error)) throw new Error('rate limit store error');
        return out.map((r) => r.result);
    }

    async check(key: string): Promise<RateLimitResult> {
        const local = this.local.check(key);
        if (!this.store || !local.allowed) return local;
        const t = this.now();
        const { k, end } = this.windowKey(key, t);
        try {
            const [count] = await this.call([['INCR', k], ['PEXPIRE', k, this.windowMs * 2]]);
            const n = Number(count);
            const allowed = n <= this.limit;
            return { allowed, remaining: Math.max(0, this.limit - n), retryAfterSeconds: allowed ? 0 : Math.max(1, Math.ceil((end - t) / 1000)) };
        } catch {
            return local;
        }
    }

    async exceeded(key: string): Promise<boolean> {
        if (this.local.exceeded(key)) return true;
        if (!this.store) return false;
        try {
            const [count] = await this.call([['GET', this.windowKey(key, this.now()).k]]);
            return Number(count ?? 0) > this.limit;
        } catch {
            return false;
        }
    }
}

const perMinute = Number(process.env.RATE_LIMIT_PER_MINUTE) || 600;
export const sdkRateLimiter = new SharedRateLimiter('sdk', perMinute, 60_000);

/** Management API calls made with a secret key (cro_sk_...), per key. Dashboard sessions are not limited here. */
const apiPerMinute = Number(process.env.API_RATE_LIMIT_PER_MINUTE) || 120;
export const apiRateLimiter = new SharedRateLimiter('api', apiPerMinute, 60_000);

/**
 * Requests per minute and client address that name a key we do not know. Real sites never send these, so the cap
 * is low. It stops one address from trying made-up keys, each of which would otherwise cost a database lookup.
 */
const unknownKeysPerMinute = Number(process.env.UNKNOWN_KEY_LIMIT_PER_MINUTE) || 30;
export const unknownKeyLimiter = new SharedRateLimiter('badkey', unknownKeysPerMinute, 60_000);
