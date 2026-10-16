import { redirect } from 'next/navigation';
import { getAppContext } from '@/lib/appContext';
import { db } from '@/lib/db';
import { isProfileComplete } from '@/lib/profile';
import { isProfileExempt } from '@/lib/profileGate';
import { ProfilePrompt } from '../components/profile/ProfilePrompt';
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

    const user = await db.getUser(ctx.user.id);
    const exempt = isProfileExempt(ctx.user.email);
    const complete = isProfileComplete(user);
    // New sign-ups see onboarding before the dashboard.
    if (user?.onboarding_pending && !complete && !exempt) redirect('/onboarding');
    const showPrompt = !complete && !exempt && !user?.profile_prompt_dismissed_at;

    return (
        <AppShell user={ctx.user} projects={ctx.projects} currentProjectId={ctx.current?.id ?? null} isPlatformAdmin={ctx.isPlatformAdmin}>
            {showPrompt && <ProfilePrompt />}
            {children}
        </AppShell>
    );
}
