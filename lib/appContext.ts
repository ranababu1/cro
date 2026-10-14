import { cookies } from 'next/headers';
import { getServerSession } from 'next-auth';
import { authOptions } from './auth';
import { db } from './db';
import { isPlatformAdminEmail } from './platformAdmin';
import { PROJECT_COOKIE, pickProject } from './currentProject';

/** Session, accessible projects and the selected project for server-rendered app pages. */
export async function getAppContext() {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return null;
    const all = await db.getProjectsForUser(session.user.id);
    const projects = all.filter((p) => p.org_status === 'active');
    const orgs = await Promise.all([...new Set(projects.map((p) => p.org_id))].map((id) => db.getOrganization(id)));
    const named = projects.map((p) => ({ ...p, org_name: orgs.find((o) => o?.id === p.org_id)?.name ?? '' }));
    const store = await cookies();
    return {
        user: { id: session.user.id, name: session.user.name ?? '', email: session.user.email ?? '' },
        projects: named,
        current: pickProject(named, store.get(PROJECT_COOKIE)?.value),
        suspended: all.length > 0 && projects.length === 0,
        isPlatformAdmin: isPlatformAdminEmail(session.user.email),
    };
}

export type AppContext = NonNullable<Awaited<ReturnType<typeof getAppContext>>>;
