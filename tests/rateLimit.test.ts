import { describe, it, expect } from 'vitest';
import { RateLimiter } from '@/lib/rateLimit';

describe('RateLimiter', () => {
    it('allows up to the limit then blocks with a retry hint', () => {
        let t = 0;
        const rl = new RateLimiter(3, 60_000, () => t);
        expect(rl.check('a').allowed).toBe(true);
        expect(rl.check('a').allowed).toBe(true);
        expect(rl.check('a').allowed).toBe(true);
        const blocked = rl.check('a');
        expect(blocked.allowed).toBe(false);
        expect(blocked.retryAfterSeconds).toBe(60);
        t = 30_000;
        expect(rl.check('a').retryAfterSeconds).toBe(30);
    });

    it('resets after the window', () => {
        let t = 0;
        const rl = new RateLimiter(1, 1000, () => t);
        rl.check('a');
        expect(rl.check('a').allowed).toBe(false);
        t = 1000;
        expect(rl.check('a').allowed).toBe(true);
    });

    it('tracks keys separately', () => {
        const rl = new RateLimiter(1, 1000, () => 0);
        expect(rl.check('a').allowed).toBe(true);
        expect(rl.check('b').allowed).toBe(true);
        expect(rl.check('a').allowed).toBe(false);
    });
});
