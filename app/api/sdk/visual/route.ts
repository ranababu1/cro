import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { formatZodError } from '@/lib/validation';
import { hostFromRequestHeaders, isHostAllowed } from '@/lib/domains';
import { isLocalHost } from '@/lib/domainLedger';
import { parseChanges, visualChangesSchema } from '@/lib/visualChanges';
import { verifyEditorToken } from '@/lib/visualEditorToken';
import { editableVariation, saveChanges } from '@/lib/visualEditor';
import type { Experiment, Variation } from '@/lib/types';

const CORS: Record<string, string> = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Editor-Token',
    'Access-Control-Max-Age': '86400',
    'Cache-Control': 'no-store',
};
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: CORS });

export function OPTIONS() {
    return new Response(null, { status: 204, headers: CORS });
}

/**
 * Visual editor on the customer's page. The editor token (from the dashboard, 2 hours) is the only credential and
 * covers one variation. The page must be on one of the project's domains (or localhost) and the user must still
 * have access to the project.
 */
type Loaded = { error: NextResponse } | { experiment: Experiment; variation: Variation; userId: string };

async function load(request: NextRequest): Promise<Loaded> {
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

export async function GET(request: NextRequest) {
    const r = await load(request);
    if ('error' in r) return r.error;
    return json({ experiment_name: r.experiment.name, variation_name: r.variation.name, status: r.experiment.status, control_url: r.experiment.control_url, changes: parseChanges(r.variation.changes) });
}

export async function PUT(request: NextRequest) {
    try {
        const r = await load(request);
        if ('error' in r) return r.error;
        const parsed = visualChangesSchema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return json({ error: formatZodError(parsed.error) }, 400);
        return json({ changes: await saveChanges(r.experiment, r.variation, parsed.data.changes, r.userId, 'editor') });
    } catch (error) {
        console.error('visual editor save failed', error);
        return json({ error: 'Failed to save' }, 500);
    }
}
