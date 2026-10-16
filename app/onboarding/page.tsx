import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { isProfileComplete, safeNext, toValues } from '@/lib/profile';
import { Logo } from '@/app/components/ui/Logo';
import { Card, CardBody } from '@/app/components/ui';
import { ProfileForm } from '@/app/components/profile/ProfileForm';

export const metadata: Metadata = { title: 'Welcome', robots: { index: false } };
export const dynamic = 'force-dynamic';

export default async function OnboardingPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) redirect('/signin');
    const user = await db.getUser(session.user.id);
    if (!user) redirect('/signin');
    const next = safeNext((await searchParams).next);
    if (!user.onboarding_pending || isProfileComplete(user)) redirect(next);
    return (
        <div className="app-scope min-h-screen bg-zinc-50 px-4 py-10">
            <div className="mx-auto max-w-2xl">
                <Logo />
                <h1 className="mt-8 text-2xl font-semibold text-zinc-900">Welcome! Tell us a little about you</h1>
                <p className="mt-2 text-sm text-zinc-600">This takes a minute. Name and country are required to create experiments. You can change these later in Settings, Profile.</p>
                <Card className="mt-6">
                    <CardBody>
                        <ProfileForm initial={toValues(user)} next={next} submitLabel="Continue to dashboard" onboarding />
                    </CardBody>
                </Card>
            </div>
        </div>
    );
}
