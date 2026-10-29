import { after } from 'next/server';
import { aiUsageCutoff } from './ai/usage';
import { db } from './db';
import { RAW_RETENTION_DAYS } from './heatmaps';
import { AUDIT_RETENTION_DAYS } from './audit';
import { SUPER_ADMIN_EMAIL } from './entitlements';
import { platformAdminEmails } from './platformAdmin';
import { ABUSE_EVENT_RETENTION_DAYS, SIGNUP_COUNT_RETENTION_DAYS } from './signupLimits';

/**
 * Retention cleanup without a cron. Busy SDK routes call scheduleRetention(); at most once an hour across all
 * instances (claimed atomically in maintenance_runs) one request deletes, after its response is sent:
 * - raw heatmap clicks and scroll rows older than 30 days (heatmaps keep their daily totals),
 * - survey answers older than the plan's data retention (Free 6 months, Starter 12, Growth and Enterprise 24),
 * - audit log entries older than the plan's audit period (Free 30 days, Starter 90, Growth 1 year, Enterprise 2 years),
 * - webhook delivery records older than 30 days,
 * - sign-up counters older than 30 days and abuse events without an org older than 180 days.
 * Each run deletes a bounded number of rows, so a large backlog is cleared over several runs.
 */
export const RETENTION_JOB = 'retention';
export const RETENTION_EVERY_MS = 60 * 60 * 1000;
/** Instances skip even the claim query for this long after they last checked. */
const LOCAL_CHECK_MS = 10 * 60 * 1000;
export const DELETE_LIMIT = 5000;
/** Survey answer retention in days, by plan, matching the data retention row on the pricing page. */
export const SURVEY_RETENTION_DAYS = { free: 183, starter: 365, growth: 730, enterprise: 730 } as const;

const DAY_MS = 86_400_000;
const dayOf = (t: number) => new Date(t).toISOString().slice(0, 10);

/** Cutoffs: rows strictly before these are deleted. Survey cutoffs are UTC days, heatmap cutoff is a timestamp. */
export function retentionCutoffs(now = new Date()) {
    const t = now.getTime();
    return {
        heatmapBefore: new Date(t - RAW_RETENTION_DAYS * DAY_MS).toISOString(),
        surveyBefore: {
            free: dayOf(t - SURVEY_RETENTION_DAYS.free * DAY_MS),
            starter: dayOf(t - SURVEY_RETENTION_DAYS.starter * DAY_MS),
            growth: dayOf(t - SURVEY_RETENTION_DAYS.growth * DAY_MS),
            enterprise: dayOf(t - SURVEY_RETENTION_DAYS.enterprise * DAY_MS),
        },
        auditBefore: {
            free: new Date(t - AUDIT_RETENTION_DAYS.free * DAY_MS).toISOString(),
            starter: new Date(t - AUDIT_RETENTION_DAYS.starter * DAY_MS).toISOString(),
            growth: new Date(t - AUDIT_RETENTION_DAYS.growth * DAY_MS).toISOString(),
            enterprise: new Date(t - AUDIT_RETENTION_DAYS.enterprise * DAY_MS).toISOString(),
        },
    };
}

/** Runs the cleanup if no instance ran it in the last hour. Returns what was deleted, or null when not due. */
export async function runRetention(now = new Date()): Promise<{ heatmapPoints: number; heatmapScrolls: number; surveyAnswers: number; auditEntries: number; webhookDeliveries: number; signupCounts: number; abuseEvents: number; aiUsage: number } | null> {
    const claimed = await db.claimMaintenance(RETENTION_JOB, new Date(now.getTime() - RETENTION_EVERY_MS).toISOString(), now.toISOString());
    if (!claimed) return null;
    const c = retentionCutoffs(now);
    const heatmapPoints = await db.deleteOldHeatmapPoints(c.heatmapBefore, DELETE_LIMIT);
    const heatmapScrolls = await db.deleteOldHeatmapScrolls(c.heatmapBefore, DELETE_LIMIT);
    // Orgs a platform admin owns keep Enterprise retention, as everywhere else.
    const admins = [...new Set([SUPER_ADMIN_EMAIL, ...platformAdminEmails()])];
    const surveyAnswers = await db.deleteOldSurveyAnswers(c.surveyBefore, DELETE_LIMIT, admins);
    const auditEntries = await db.deleteOldAuditEntries(c.auditBefore, DELETE_LIMIT, admins);
    const webhookDeliveries = await db.deleteOldWebhookDeliveries(new Date(now.getTime() - 30 * DAY_MS).toISOString(), DELETE_LIMIT);
    const signupCounts = await db.deleteOldSignupCounts(dayOf(now.getTime() - SIGNUP_COUNT_RETENTION_DAYS * DAY_MS), DELETE_LIMIT);
    const abuseEvents = await db.deleteOldAbuseEvents(new Date(now.getTime() - ABUSE_EVENT_RETENTION_DAYS * DAY_MS).toISOString(), DELETE_LIMIT);
    const aiUsage = await db.deleteOldAiUsage(aiUsageCutoff(now), DELETE_LIMIT);
    return { heatmapPoints, heatmapScrolls, surveyAnswers, auditEntries, webhookDeliveries, signupCounts, abuseEvents, aiUsage };
}

let lastLocalCheck = 0;

/** Cheap to call on every request: most calls return at once; a due run happens after the response. */
export function scheduleRetention(now = Date.now()): void {
    if (now - lastLocalCheck < LOCAL_CHECK_MS) return;
    lastLocalCheck = now;
    const run = () => runRetention().then(() => undefined).catch((err) => console.error('retention cleanup failed', err));
    try { after(run); } catch { void run(); }
}

/** Tests only. */
export function resetRetentionThrottle(): void {
    lastLocalCheck = 0;
}
