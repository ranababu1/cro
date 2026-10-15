import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireUserContext } from '@/lib/requestAuth';
import { getAccessibleExperiment, orgIdForProject } from '@/lib/access';
import { publicAppOrigin } from '@/lib/publicOrigin';

type Params = { params: Promise<{ id: string }> };

const shareUrl = (token: string) => `${publicAppOrigin()}/share/${token}`;

async function load(request: NextRequest, params: Params['params']) {
    const ctx = await requireUserContext(request);
    if (ctx instanceof NextResponse) return { ok: false as const, error: ctx };
    const { id } = await params;
    const experiment = await getAccessibleExperiment(ctx, id);
    if (!experiment) return { ok: false as const, error: NextResponse.json({ error: 'Experiment not found' }, { status: 404 }) };
    return { ok: true as const, ctx, experiment };
}

/** GET: the active share link, if any. */
export async function GET(request: NextRequest, { params }: Params) {
    const r = await load(request, params);
    if (!r.ok) return r.error;
    const link = await db.getActiveShareLink(r.experiment.id);
    return NextResponse.json({ url: link ? shareUrl(link.token) : null, created_at: link?.created_at ?? null });
}

/** POST: create a read-only results link (returns the existing one if active). */
export async function POST(request: NextRequest, { params }: Params) {
    const r = await load(request, params);
    if (!r.ok) return r.error;
    let link = await db.getActiveShareLink(r.experiment.id);
    if (!link) {
        link = await db.createShareLink(r.experiment.id, r.ctx.userId);
        await db.audit({ orgId: await orgIdForProject(r.experiment.project_id), actorId: r.ctx.userId, entity: 'experiment', entityId: r.experiment.id, action: 'share:create' });
    }
    return NextResponse.json({ url: shareUrl(link.token), created_at: link.created_at }, { status: 201 });
}

/** DELETE: turn the link off. Anyone with the old link loses access at once. */
export async function DELETE(request: NextRequest, { params }: Params) {
    const r = await load(request, params);
    if (!r.ok) return r.error;
    await db.revokeShareLinks(r.experiment.id);
    await db.audit({ orgId: await orgIdForProject(r.experiment.project_id), actorId: r.ctx.userId, entity: 'experiment', entityId: r.experiment.id, action: 'share:revoke' });
    return NextResponse.json({ url: null });
}
