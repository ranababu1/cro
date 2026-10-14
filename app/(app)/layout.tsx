import { redirect } from 'next/navigation';
import { getAppContext } from '@/lib/appContext';
import AppShell from '../components/shell/AppShell';
import { Logo } from '../components/ui/Logo';

export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
    const ctx = await getAppContext();
    if (!ctx) redirect('/signin');

    if (ctx.suspended) {
        return (
            <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 px-4 text-center">
                <Logo />
                <h1 className="mt-8 text-xl font-semibold text-zinc-900">This account is suspended</h1>
                <p className="mt-2 max-w-md text-sm text-zinc-600">
                    Your organization has been suspended. Your data is kept. Contact support to restore access.
                </p>
            </div>
        );
    }

    return (
        <AppShell user={ctx.user} projects={ctx.projects} currentProjectId={ctx.current?.id ?? null} isPlatformAdmin={ctx.isPlatformAdmin}>
            {children}
        </AppShell>
    );
}
