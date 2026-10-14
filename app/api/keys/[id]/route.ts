import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserContext, unauthorized } from '@/lib/requestAuth';
import { orgIdForProject } from '@/lib/access';

// DELETE /api/keys/[id] - Revoke a key. Session only.
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const ctx = await getUserContext(request);
    if (!ctx || ctx.via !== 'session') return unauthorized();
    const { id } = await params;
    const projectId = await db.getApiKeyProject(id);
    if (!projectId || !ctx.projectIds.includes(projectId)) {
        return NextResponse.json({ error: 'Key not found' }, { status: 404 });
    }
    await db.revokeApiKey(id);
    await db.audit({ orgId: await orgIdForProject(projectId), actorId: ctx.userId, entity: 'api_key', entityId: id, action: 'revoke' });
    return NextResponse.json({ success: true });
}
