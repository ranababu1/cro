import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireUserContext } from '@/lib/requestAuth';
import { createDomainSchema, formatZodError } from '@/lib/validation';
import { normalizeHost } from '@/lib/domains';
import { orgIdForProject } from '@/lib/access';
import { PROJECT_COOKIE } from '@/lib/currentProject';

export async function GET(request: NextRequest) {
    const ctx = await requireUserContext(request);
    if (ctx instanceof NextResponse) return ctx;
    const selected = request.cookies.get(PROJECT_COOKIE)?.value;
    const projectId = selected && ctx.projectIds.includes(selected) ? selected : ctx.projectIds[0];
    if (!projectId) return NextResponse.json({ domains: [] });
    const domains = await db.listDomains(projectId);
    return NextResponse.json({ domains, project_id: projectId });
}

export async function POST(request: NextRequest) {
    const ctx = await requireUserContext(request);
    if (ctx instanceof NextResponse) return ctx;
    const parsed = createDomainSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 });
    const host = normalizeHost(parsed.data.host);
    if (!host) return NextResponse.json({ error: 'Enter a valid domain, for example example.com' }, { status: 400 });
    const selected = request.cookies.get(PROJECT_COOKIE)?.value;
    const projectId = selected && ctx.projectIds.includes(selected) ? selected : ctx.projectIds[0];
    if (!projectId || !ctx.projectIds.includes(projectId)) {
        return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }
    const existing = await db.listDomains(projectId);
    if (existing.some((d) => d.host === host)) {
        return NextResponse.json({ error: 'That domain is already added' }, { status: 400 });
    }
    const domain = await db.addDomain(projectId, host);
    await db.audit({ orgId: await orgIdForProject(projectId), actorId: ctx.userId, entity: 'domain', entityId: domain.id, action: 'create', diff: { host } });
    return NextResponse.json({ domain }, { status: 201 });
}
