import { db } from './db';
import { orgIdForProject } from './access';
import { canUseFeature, UPGRADE_NOTE } from './entitlements';
import { parseChanges, serializeChanges, type VisualChange } from './visualChanges';
import type { Experiment, Variation } from './types';

/** A variation the visual editor may change: not the control, no URL of its own, test not completed. */
export async function editableVariation(experiment: Experiment, variationId: string): Promise<{ variation: Variation } | { error: string; status: number }> {
    const variation = (await db.getVariations(experiment.id)).find((v) => v.id === variationId);
    if (!variation) return { error: 'Variation not found', status: 404 };
    if (variation.is_control) return { error: 'The control is your original page and has no visual changes', status: 400 };
    if (variation.url) return { error: 'This variation has its own URL. Visual changes are for variations that run on the control page', status: 400 };
    if (experiment.status === 'completed') return { error: 'A completed test cannot be edited', status: 400 };
    if (!experiment.control_url) return { error: 'This test has no control URL', status: 400 };
    // Changes already saved keep showing to visitors after a downgrade; editing needs Growth and above.
    if (!(await canUseFeature(await orgIdForProject(experiment.project_id), 'visual_editor'))) return { error: UPGRADE_NOTE.visual_editor, status: 403 };
    return { variation };
}

export async function saveChanges(experiment: Experiment, variation: Variation, changes: VisualChange[], actorId: string, via: 'dashboard' | 'editor'): Promise<VisualChange[]> {
    await db.setVariationChanges(experiment.id, variation.id, serializeChanges(changes));
    await db.audit({
        orgId: await orgIdForProject(experiment.project_id),
        actorId,
        entity: 'experiment',
        entityId: experiment.id,
        action: 'variation:changes',
        diff: { variation_id: variation.id, via, before: parseChanges(variation.changes).length, after: changes.length },
    });
    return changes;
}
