import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { requireUserContext } from '@/lib/requestAuth';
import { getAccessibleExperiment, orgIdForProject } from '@/lib/access';
import { canUseFeature, UPGRADE_NOTE } from '@/lib/entitlements';
import { AUTO_SHIFT_FLOOR, AUTO_SHIFT_INTERVAL_MS, AUTO_SHIFT_MIN_VISITORS } from '@/lib/autoShift';
import type { Experiment } from '@/lib/types';

type Params = { params: Promise<{ id: string }> };

async function load(request: NextRequest, params: Params['params']): Promise<{ experiment: Experiment; orgId: string; userId: string | null; allowed: boolean } | NextResponse> {
    const ctx = await requireUserContext(request);
    if (ctx instanceof NextResponse) return ctx;
    const { id } = await params;
    const experiment = await getAccessibleExperiment(ctx, id);
    if (!experiment) return NextResponse.json({ error: 'Experiment not found' }, { status: 404 });
    const orgId = await orgIdForProject(experiment.project_id);
    if (!orgId) return NextResponse.json({ error: 'Experiment not found' }, { status: 404 });
    return { experiment, orgId, userId: ctx.userId, allowed: await canUseFeature(orgId, 'auto_shift') };
}

const describe = (e: Experiment, allowed: boolean) => ({
    allowed,
    enabled: !!e.auto_shift,
    last_check_at: e.auto_shift_at,
    min_visitors: AUTO_SHIFT_MIN_VISITORS,
    floor_percent: AUTO_SHIFT_FLOOR,
    interval_minutes: AUTO_SHIFT_INTERVAL_MS / 60_000,
    ...(allowed ? {} : { upgrade: UPGRADE_NOTE.auto_shift }),
});

/** GET /api/experiments/[id]/auto-shift: whether auto-shift is available and on. */
export async function GET(request: NextRequest, { params }: Params) {
    try {
        const r = await load(request, params);
        if (r instanceof NextResponse) return r;
        return NextResponse.json(describe(r.experiment, r.allowed));
    } catch (error) {
        console.error('Failed to read auto-shift:', error);
        return NextResponse.json({ error: 'Failed to read auto-shift' }, { status: 500 });
    }
}

const body = z.object({ enabled: z.boolean() }).strict();

/** PATCH /api/experiments/[id]/auto-shift { enabled }: Growth plan and above. Turning it off keeps the current split. */
export async function PATCH(request: NextRequest, { params }: Params) {
    try {
        const r = await load(request, params);
        if (r instanceof NextResponse) return r;
        const parsed = body.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return NextResponse.json({ error: 'Send { enabled: true } or { enabled: false }' }, { status: 400 });
        if (parsed.data.enabled && !r.allowed) return NextResponse.json({ error: 'Auto-shift needs the Growth plan or above', upgrade: UPGRADE_NOTE.auto_shift }, { status: 403 });
        if (r.experiment.status === 'completed') return NextResponse.json({ error: 'A completed test cannot be edited' }, { status: 400 });
        await db.setAutoShift(r.experiment.id, parsed.data.enabled);
        await db.audit({ orgId: r.orgId, actorId: r.userId, entity: 'experiment', entityId: r.experiment.id, action: parsed.data.enabled ? 'auto_shift:on' : 'auto_shift:off' });
        const updated = await db.getExperiment(r.experiment.id);
        return NextResponse.json(describe(updated ?? r.experiment, r.allowed));
    } catch (error) {
        console.error('Failed to update auto-shift:', error);
        return NextResponse.json({ error: 'Failed to update auto-shift' }, { status: 500 });
    }
}
