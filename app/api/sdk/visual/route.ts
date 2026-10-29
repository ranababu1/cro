import { NextRequest } from 'next/server';
import { formatZodError } from '@/lib/validation';
import { parseChanges, visualChangesSchema } from '@/lib/visualChanges';
import { saveChanges } from '@/lib/visualEditor';
import { CORS, json, load } from '@/lib/visualEditorRequest';
import { orgIdForProject } from '@/lib/access';
import { aiStatus } from '@/lib/ai/service';

export function OPTIONS() {
    return new Response(null, { status: 204, headers: CORS });
}

export async function GET(request: NextRequest) {
    const r = await load(request);
    if ('error' in r) return r.error;
    const ai = await aiStatus(await orgIdForProject(r.experiment.project_id)).then((a) => a.ready).catch(() => false);
    return json({ experiment_name: r.experiment.name, variation_name: r.variation.name, status: r.experiment.status, control_url: r.experiment.control_url, changes: parseChanges(r.variation.changes), ai });
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
