import { urlsMatch } from './domains';
import { parseChanges } from './visualChanges';
import { failedRule, parseTargeting, type VisitorContext } from './targeting';
import type { BootstrapResponse, Experiment, Variation } from './types';

/**
 * Roll out the winner. A rolled-out test is completed and sends every visitor in its audience to one variation
 * until the change is in the site's own code. Nothing is recorded: no assignment, event, visitor count or analytics.
 * The SDK reply uses matched: false, so the SDK redirects or applies visual changes without tracking.
 */
export const ROLLOUT_FROM: ReadonlyArray<Experiment['status']> = ['running', 'paused', 'completed'];

/** The rolled-out variation, or null when the rollout is off or points at a variation that no longer exists. */
export function rolloutVariation(experiment: Pick<Experiment, 'status' | 'rollout_variation_id'>, variations: Variation[]): Variation | null {
    if (experiment.status !== 'completed' || !experiment.rollout_variation_id) return null;
    return variations.find((v) => v.id === experiment.rollout_variation_id) ?? null;
}

/** True when the URL is one of the test's pages (control or a variation URL). */
export function rolloutCoversUrl(experiment: Pick<Experiment, 'control_url'>, variations: Variation[], url: string): boolean {
    const urls = [experiment.control_url, ...variations.map((v) => v.url)].filter(Boolean) as string[];
    return urls.some((u) => urlsMatch(u, url));
}

/** SDK reply for a page of a rolled-out test. */
export function rolloutReply(experiment: Experiment, variations: Variation[], ctx: VisitorContext): BootstrapResponse {
    const none: BootstrapResponse = { matched: false, action: 'none', reason: 'rollout' };
    const winner = rolloutVariation(experiment, variations);
    if (!winner) return none;
    if (failedRule(parseTargeting(experiment.targeting), ctx)) return { ...none, reason: 'not_targeted' };
    const controlUrl = experiment.control_url || variations.find((v) => v.is_control)?.url || '';
    const base = { matched: false, experiment_id: experiment.id, variation_id: winner.id, reason: 'rollout' } as const;
    // A URL variation or the control: everyone goes to that page.
    const target = winner.is_control ? controlUrl : winner.url || '';
    if (target) {
        if (urlsMatch(target, ctx.url)) return { ...base, action: 'none' };
        return { ...base, action: 'redirect', variation_url: target };
    }
    // A visual variation runs on the control page; visitors on another variation's page go back to the control.
    if (controlUrl && !urlsMatch(controlUrl, ctx.url)) return { ...base, action: 'redirect', variation_url: controlUrl };
    const changes = parseChanges(winner.changes);
    return changes.length ? { ...base, action: 'stay', changes } : { ...base, action: 'none' };
}
