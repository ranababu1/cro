import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { formatZodError } from '@/lib/validation';
import { updatePopupSchema } from '@/lib/popups';
import { popupJson, popupProject } from '@/lib/popupRoutes';

type Params = { params: Promise<{ id: string }> };

async function load(request: NextRequest, params: Params['params']) {
    const r = await popupProject(request);
    if (r instanceof NextResponse) return r;
    const { id } = await params;
    const popup = await db.getPopup(id);
    // Popups in another project of the same user are found through that project, never by id alone.
    if (!popup || !r.projectIds.includes(popup.project_id)) return NextResponse.json({ error: 'Popup not found' }, { status: 404 });
    return { ...r, popup };
}

/** PATCH /api/popups/[id]: rename, change content or targeting, turn on or pause. */
export async function PATCH(request: NextRequest, { params }: Params) {
    try {
        const r = await load(request, params);
        if (r instanceof NextResponse) return r;
        const parsed = updatePopupSchema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 });
        const { config, ...rest } = parsed.data;
        const p = await db.updatePopup(r.popup.id, { ...rest, ...(config ? { config: JSON.stringify(config) } : {}) });
        await db.audit({ orgId: r.orgId, actorId: r.userId, entity: 'popup', entityId: r.popup.id, action: 'update', diff: parsed.data });
        return NextResponse.json({ popup: popupJson(p) });
    } catch (error) {
        console.error('Failed to update popup:', error);
        return NextResponse.json({ error: 'Failed to update popup' }, { status: 500 });
    }
}

/** DELETE /api/popups/[id]: removes the popup and its counts. */
export async function DELETE(request: NextRequest, { params }: Params) {
    try {
        const r = await load(request, params);
        if (r instanceof NextResponse) return r;
        await db.deletePopup(r.popup.id);
        await db.audit({ orgId: r.orgId, actorId: r.userId, entity: 'popup', entityId: r.popup.id, action: 'delete' });
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Failed to delete popup:', error);
        return NextResponse.json({ error: 'Failed to delete popup' }, { status: 500 });
    }
}
