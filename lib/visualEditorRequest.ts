import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { hostFromRequestHeaders, isHostAllowed } from '@/lib/domains';
import { isLocalHost } from '@/lib/domainLedger';
import { verifyEditorToken } from '@/lib/visualEditorToken';
import { editableVariation } from '@/lib/visualEditor';
import type { Experiment, Variation } from '@/lib/types';

export const CORS: Record<string, string> = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, PUT, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Editor-Token',
    'Access-Control-Max-Age': '86400',
    'Cache-Control': 'no-store',
};
export const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: CORS });

/**
 * Visual editor on the customer's page. The editor token (from the dashboard, 2 hours) is the only credential and
 * covers one variation. The page must be on one of the project's domains (or localhost) and the user must still
 * have access to the project.
 */
export type Loaded = { error: NextResponse } | { experiment: Experiment; variation: Variation; userId: string };

export async function load(request: NextRequest): Promise<Loaded> {
    const claim = verifyEditorToken(request.headers.get('x-editor-token'));
    if (!claim) return { error: json({ error: 'This editor link has expired. Open the visual editor again from the dashboard.' }, 401) };
    const experiment = await db.getExperiment(claim.experimentId);
    if (!experiment) return { error: json({ error: 'Experiment not found' }, 404) };
    const projects = await db.getProjectsForUser(claim.userId);
    if (!projects.some((p) => p.id === experiment.project_id && p.org_status === 'active')) return { error: json({ error: 'You no longer have access to this test' }, 403) };
    const host = hostFromRequestHeaders(request.headers.get('origin'), request.headers.get('referer'));
    if (!isLocalHost(host) && !isHostAllowed(host, await db.getDomainHosts(experiment.project_id))) {
        return { error: json({ error: 'Open the editor on a page of a registered domain' }, 403) };
    }
    const r = await editableVariation(experiment, claim.variationId);
    if ('error' in r) return { error: json({ error: r.error }, r.status) };
    return { experiment, variation: r.variation, userId: claim.userId };
}

