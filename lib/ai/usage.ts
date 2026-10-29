import { db } from '../db';

/**
 * Per-organization limit on AI requests, counted in the database so every server sees the same count. The customer
 * pays the provider, so this guards against runaway loops and abuse of a stolen session rather than cost.
 */
export const AI_HOURLY_LIMIT = 60;
export const AI_DAILY_LIMIT = 300;
const HOUR_MS = 3_600_000;
const USAGE_KEEP_HOURS = 72;

export const hourOf = (t: number) => new Date(t).toISOString().slice(0, 13);

/** Rows with an hour before this are deleted by the retention job. */
export const aiUsageCutoff = (now = new Date()) => hourOf(now.getTime() - USAGE_KEEP_HOURS * HOUR_MS);

/** Counts one request, or gives the slot back and returns false when the org is over a limit. */
export async function takeAiSlot(orgId: string, now = Date.now()): Promise<{ ok: true } | { ok: false; window: 'hour' | 'day' }> {
    const hour = hourOf(now);
    const inHour = await db.bumpAiUsage(orgId, hour);
    if (inHour > AI_HOURLY_LIMIT) {
        await db.bumpAiUsage(orgId, hour, -1);
        return { ok: false, window: 'hour' };
    }
    const inDay = await db.sumAiUsage(orgId, hourOf(now - 23 * HOUR_MS));
    if (inDay > AI_DAILY_LIMIT) {
        await db.bumpAiUsage(orgId, hour, -1);
        return { ok: false, window: 'day' };
    }
    return { ok: true };
}
