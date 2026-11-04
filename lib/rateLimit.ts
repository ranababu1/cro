/**
 * Fixed-window rate limiter kept in process memory.
 * Good enough for a single instance. On serverless with many instances each instance
 * keeps its own counters, so swap in a shared store (Redis, Upstash) before scaling out.
 * Memory is bounded: at most maxKeys windows are kept.
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

const perMinute = Number(process.env.RATE_LIMIT_PER_MINUTE) || 600;
export const sdkRateLimiter = new RateLimiter(perMinute, 60_000);

/** Management API calls made with a secret key (cro_sk_...), per key. Dashboard sessions are not limited here. */
const apiPerMinute = Number(process.env.API_RATE_LIMIT_PER_MINUTE) || 120;
export const apiRateLimiter = new RateLimiter(apiPerMinute, 60_000);

/**
 * Requests per minute and client address that name a key we do not know. Real sites never send these, so the cap
 * is low. It stops one address from trying made-up keys, each of which would otherwise cost a database lookup.
 */
const unknownKeysPerMinute = Number(process.env.UNKNOWN_KEY_LIMIT_PER_MINUTE) || 30;
export const unknownKeyLimiter = new RateLimiter(unknownKeysPerMinute, 60_000);
