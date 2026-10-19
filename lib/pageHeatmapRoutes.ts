import { NextRequest, NextResponse } from 'next/server';
import { db } from './db';
import { featureProject, ownerScope } from './popupRoutes';
import { DEVICES, type Device } from './heatmaps';
import type { PageHeatmapRow } from './pageHeatmaps';

export type PageScope = { projectId: string; orgId: string; userId: string | null; projectIds: string[] };

/** The current project for the Page heatmaps screen, with the plan check. */
export function pageHeatmapProject(request: NextRequest) {
    return featureProject(request, 'heatmaps');
}

/** A page heatmap the signed-in user can reach, scoped to the organization that owns it (plan check included). */
export async function loadPageHeatmap(request: NextRequest, id: string): Promise<NextResponse | (PageScope & { heatmap: PageHeatmapRow })> {
    const r = await pageHeatmapProject(request);
    if (r instanceof NextResponse) return r;
    const heatmap = await db.getPageHeatmap(id);
    // Found through one of the user's projects, never by id alone.
    if (!heatmap || !r.projectIds.includes(heatmap.project_id)) return NextResponse.json({ error: 'Page heatmap not found' }, { status: 404 });
    const scope = await ownerScope(r, heatmap.project_id, 'heatmaps');
    if (scope instanceof NextResponse) return scope;
    return { ...scope, heatmap };
}

export function deviceParam(sp: URLSearchParams): Device | 'all' {
    const v = sp.get('device') ?? 'all';
    return (v === 'all' || (DEVICES as readonly string[]).includes(v) ? v : 'all') as Device | 'all';
}
