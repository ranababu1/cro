import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { formatZodError } from '@/lib/validation';
import { createPopupSchema, MAX_POPUPS_PER_PROJECT, popupStats } from '@/lib/popups';
import { popupJson, popupProject } from '@/lib/popupRoutes';
import { flushTelemetry } from '@/lib/telemetry';
import { lastDays } from '@/lib/traffic';

/** GET /api/popups: popups of the current project with views, clicks and closes for the last 30 days. Paid only. */
export async function GET(request: NextRequest) {
    try {
        const r = await popupProject(request);
        if (r instanceof NextResponse) return r;
        await flushTelemetry();
        const days = lastDays(30);
        const [list, rows] = await Promise.all([db.listPopups(r.projectId), db.getPopupStats(r.projectId, days[0], days[days.length - 1])]);
        const stats = popupStats(rows);
        return NextResponse.json({
            project_id: r.projectId,
            max: MAX_POPUPS_PER_PROJECT,
            popups: list.map((p) => ({ ...popupJson(p), stats: stats.get(p.id) ?? { views: 0, clicks: 0, closes: 0, ctr: null } })),
        });
    } catch (error) {
        console.error('Failed to list popups:', error);
        return NextResponse.json({ error: 'Failed to load popups' }, { status: 500 });
    }
}

/** POST /api/popups: create a popup in the current project. */
export async function POST(request: NextRequest) {
    try {
        const r = await popupProject(request);
        if (r instanceof NextResponse) return r;
        const parsed = createPopupSchema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 });
        if ((await db.listPopups(r.projectId)).length >= MAX_POPUPS_PER_PROJECT) {
            return NextResponse.json({ error: `A project can have up to ${MAX_POPUPS_PER_PROJECT} popups. Delete one you no longer use.` }, { status: 400 });
        }
        const p = await db.createPopup({ project_id: r.projectId, name: parsed.data.name, status: parsed.data.status, config: JSON.stringify(parsed.data.config) });
        await db.audit({ orgId: r.orgId, actorId: r.userId, entity: 'popup', entityId: p.id, action: 'create', diff: parsed.data });
        return NextResponse.json({ popup: popupJson(p) }, { status: 201 });
    } catch (error) {
        console.error('Failed to create popup:', error);
        return NextResponse.json({ error: 'Failed to create popup' }, { status: 500 });
    }
}
