import { db } from './db';
import type { UserContext } from './requestAuth';
import type { Experiment } from './types';

/** Loads an experiment only if it belongs to a project the caller can access. */
export async function getAccessibleExperiment(ctx: UserContext, id: string): Promise<Experiment | null> {
    const experiment = await db.getExperiment(id);
    if (!experiment || !ctx.projectIds.includes(experiment.project_id)) return null;
    return experiment;
}

export async function orgIdForProject(projectId: string): Promise<string> {
    const project = await db.getProject(projectId);
    if (!project) throw new Error('Project not found');
    return project.org_id;
}
