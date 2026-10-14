import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserContext, unauthorized } from '@/lib/requestAuth';
import { createApiKeySchema, formatZodError } from '@/lib/validation';
import { orgIdForProject } from '@/lib/access';

// GET /api/keys - Environments and API keys (prefix only) for the caller's projects. Session only.
export async function GET(request: NextRequest) {
    const ctx = await getUserContext(request);
    if (!ctx || ctx.via !== 'session') return unauthorized();
    const projects = await Promise.all(
        ctx.projectIds.map(async (projectId) => ({
            project: await db.getProject(projectId),
            environments: await db.getEnvironments(projectId),
            keys: await db.listApiKeys(projectId),
        })),
    );
    return NextResponse.json({ projects });
}

// POST /api/keys - Create a key. The plaintext is returned once and never stored.
export async function POST(request: NextRequest) {
    const ctx = await getUserContext(request);
    if (!ctx || ctx.via !== 'session') return unauthorized();
    const parsed = createApiKeySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 });

    const env = await db.getEnvironment(parsed.data.environment_id);
    if (!env || !ctx.projectIds.includes(env.project_id)) {
        return NextResponse.json({ error: 'Environment not found' }, { status: 404 });
    }
    const created = await db.createApiKey({
        environmentId: env.id,
        type: parsed.data.type,
        label: parsed.data.label,
        createdBy: ctx.userId ?? undefined,
    });
    await db.audit({
        orgId: await orgIdForProject(env.project_id),
        actorId: ctx.userId,
        entity: 'api_key',
        entityId: created.id,
        action: 'create',
        diff: { type: created.type, environment: env.key, prefix: created.prefix },
    });
    return NextResponse.json(created, { status: 201 });
}
