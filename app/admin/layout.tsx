import { notFound } from 'next/navigation';
import { getPlatformAdmin } from '@/lib/platformAdmin';
import { getAppContext } from '@/lib/appContext';
import AppShell from '../components/shell/AppShell';

export const dynamic = 'force-dynamic';

// Server-side guard for every /admin page. Non-admins get a 404.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
    const admin = await getPlatformAdmin();
    if (!admin) notFound();
    const ctx = await getAppContext();
    return (
        <AppShell
            user={ctx?.user ?? { name: '', email: admin.email }}
            projects={ctx?.projects ?? []}
            currentProjectId={ctx?.current?.id ?? null}
            isPlatformAdmin
        >
            {children}
        </AppShell>
    );
}
