/**
 * Fixed-window rate limiter kept in process memory.
 * Good enough for a single instance. On serverless with many instances each instance
 * keeps its own counters, so swap in a shared store (Redis, Upstash) before scaling out.
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
    ) {}

    check(key: string): RateLimitResult {
        const t = this.now();
        let w = this.windows.get(key);
        if (!w || t - w.start >= this.windowMs) {
            w = { start: t, count: 0 };
            this.windows.set(key, w);
            if (this.windows.size > 10_000) this.sweep(t);
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
