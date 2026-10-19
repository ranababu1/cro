import type { ExperimentResults } from './types';
import { formatChance } from './sequential';

/**
 * Trims results down to what a public share page may show: names and numbers only.
 * No URLs, selectors, ids, environments or account details.
 */
export function publicResultsView(r: ExperimentResults) {
    const statusLabel = { draft: 'Draft', running: 'Running', paused: 'Paused', completed: 'Completed' }[r.status];
    const goals = r.goals.map((g) => {
        const control = g.variations.find((v) => v.is_control);
        return {
            id: g.goal_id.slice(-8),
            name: g.goal_name,
            primary: g.is_primary,
            rows: [...g.variations].sort((a, b) => Number(b.is_control) - Number(a.is_control)).map((v) => ({
                name: v.variation_name,
                control: v.is_control,
                winner: g.winner === v.variation_id,
                visitors: v.total_users,
                conversions: v.conversions,
                rate: v.conversion_rate,
                lift: v.is_control || !control || control.conversion_rate === 0 ? null : (v.conversion_rate - control.conversion_rate) / control.conversion_rate,
                ci: [v.confidence_interval?.lower ?? 0, v.confidence_interval?.upper ?? 0] as [number, number],
                chance: v.is_control ? '-' : formatChance(v.chance_to_beat_control, control?.total_users ?? 0, v.total_users),
            })),
        };
    });
    const minArm = Math.min(...r.variations.map((v) => v.total_users));
    const winner = r.variations.find((v) => v.variation_id === r.winner);
    let headline: { tone: 'success' | 'info'; title: string; text: string };
    if (minArm < 100) headline = { tone: 'info', title: 'Collecting data', text: 'Each version needs at least 100 visitors before the result is called.' };
    else if (winner) headline = { tone: 'success', title: `${winner.variation_name} is ahead`, text: 'The difference on the primary goal is significant on a sequential test that stays valid however often results are checked.' };
    else if (r.sequential?.control_ahead) headline = { tone: 'info', title: 'Control is ahead', text: 'The control converts significantly better on the primary goal.' };
    else headline = { tone: 'info', title: 'Too early to call', text: 'There is no significant difference on the primary goal yet.' };
    const srm = r.srm ? { ...r.srm, variations: r.srm.variations.map((v) => ({ ...v, variation_id: '' })) } : undefined;
    return { name: r.experiment_name, statusLabel, visitors: r.sample_size, goals, headline, srm };
}
