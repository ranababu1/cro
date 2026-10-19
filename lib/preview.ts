import { db } from './db';
import { urlsMatch } from './domains';
import { onTestPage } from './multipage';
import { parseChanges } from './visualChanges';
import { verifyPreviewToken } from './previewToken';
import type { BootstrapResponse, Experiment, Variation } from './types';

export const PREVIEW_INVALID = 'This preview link has expired or is no longer valid. Ask for a new one.';

export function controlUrlOf(experiment: Experiment, variations: Variation[]): string {
    return experiment.control_url || variations.find((v) => v.is_control)?.url || '';
}

/** Why a variation cannot be previewed, or null when it can. */
export function previewBlocker(experiment: Experiment, variations: Variation[], variationId: string): string | null {
    if (!variations.some((v) => v.id === variationId)) return 'Variation not found';
    if (experiment.status === 'completed') return 'A completed test cannot be previewed';
    if (!controlUrlOf(experiment, variations)) return 'This test has no control URL';
    return null;
}

/**
 * Bootstrap reply for a QA preview link: the linked variation on this page, decided only by the link.
 * Nothing is written: no assignment, page view, visitor, goal hit or traffic count.
 */
export async function previewReply(token: string, projectId: string, url: string): Promise<BootstrapResponse> {
    const invalid: BootstrapResponse = { matched: false, action: 'none', reason: 'preview_invalid', preview: { error: PREVIEW_INVALID } };
    const t = verifyPreviewToken(token);
    if (!t) return invalid;
    const experiment = await db.getExperiment(t.experimentId);
    if (!experiment || experiment.project_id !== projectId) return invalid;
    const variations = await db.getVariations(experiment.id);
    if (previewBlocker(experiment, variations, t.variationId)) return invalid;
    const variation = variations.find((v) => v.id === t.variationId)!;
    const controlUrl = controlUrlOf(experiment, variations);
    const onControl = onTestPage(experiment, controlUrl, url);
    const onVariation = !!(variation.url && urlsMatch(variation.url, url));
    const base: BootstrapResponse = {
        matched: true,
        action: 'stay',
        reason: 'preview',
        experiment_id: experiment.id,
        variation_id: variation.id,
        variation_name: variation.name,
        variation_url: variation.url ?? undefined,
        is_control: !!variation.is_control,
        control_url: controlUrl,
        preview: { experiment_name: experiment.name, variation_name: variation.name, on_page: onControl || onVariation },
    };
    if (!variation.is_control && variation.url && onControl && !onVariation) return { ...base, action: 'redirect' };
    const changes = !variation.is_control && !variation.url && onControl ? parseChanges(variation.changes) : [];
    return changes.length ? { ...base, changes } : base;
}
