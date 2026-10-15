import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getAppContext } from '@/lib/appContext';
import { db } from '@/lib/db';
import { isProfileComplete, safeNext, toValues } from '@/lib/profile';
import { PageHeader, Card, CardBody, Alert } from '@/app/components/ui';
import { ProfileForm } from '@/app/components/profile/ProfileForm';

export const metadata: Metadata = { title: 'Profile' };

export default async function ProfilePage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
    const ctx = await getAppContext();
    if (!ctx) redirect('/signin');
    const user = await db.getUser(ctx.user.id);
    if (!user) redirect('/signin');
    const sp = await searchParams;
    const next = sp.next ? safeNext(sp.next) : null;
    return (
        <>
            <PageHeader title="Profile" description="Your name and country are required to create experiments. Everything else is optional." />
            {!isProfileComplete(user) && next && <Alert tone="info" className="mb-4">Complete your profile to create experiments. We will take you back when you save.</Alert>}
            <Card className="max-w-3xl">
                <CardBody>
                    <ProfileForm initial={toValues(user)} next={next} />
                </CardBody>
            </Card>
        </>
    );
}
