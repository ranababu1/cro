import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { teamContext } from '@/lib/team';
import { isProvider, PROVIDERS } from '@/lib/ai/providers';
import { aiStatus } from '@/lib/ai/service';

/** DELETE /api/ai/keys/[provider]: removes the organization's key for one provider. Owners only. Allowed on every plan, so a key can be removed after a downgrade. */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
    try {
        const t = await teamContext(request, { owner: true });
        if (t instanceof NextResponse) return t;
        const { provider } = await params;
        if (!isProvider(provider)) return NextResponse.json({ error: 'Unknown provider' }, { status: 404 });
        if (await db.deleteAiKey(t.orgId, provider)) {
            const settings = await db.getAiSettings(t.orgId);
            if (settings?.text_provider === provider) await db.setAiSettings(t.orgId, { text_provider: null, text_model: null }, t.userId);
            await db.audit({ orgId: t.orgId, actorId: t.userId, entity: 'ai_key', entityId: provider, action: 'delete', diff: { provider: PROVIDERS[provider].label } });
        }
        return NextResponse.json({ ...(await aiStatus(t.orgId)), owner: true });
    } catch (error) {
        console.error('Failed to remove AI key:', error);
        return NextResponse.json({ error: 'Failed to remove the key' }, { status: 500 });
    }
}
