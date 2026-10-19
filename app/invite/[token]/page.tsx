import type { Metadata } from 'next';
import Link from 'next/link';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { hashInviteToken, inviteState } from '@/lib/team';
import { Logo } from '../../components/ui/Logo';
import { AcceptInvite } from './AcceptInvite';

export const metadata: Metadata = { title: 'Join an organization', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

const GONE: Record<string, { title: string; body: string }> = {
    used: { title: 'This invite was already used', body: 'Each invite link works once. Ask an owner of the organization for a new one.' },
    revoked: { title: 'This invite was cancelled', body: 'Ask an owner of the organization for a new link.' },
    expired: { title: 'This invite expired', body: 'Invite links work for 7 days. Ask an owner of the organization for a new one.' },
    unknown: { title: 'This invite link is not valid', body: 'Check that you copied the whole link, or ask for a new one.' },
};

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
    const { token } = await params;
    const invite = token.length >= 20 && token.length <= 200 ? await db.getInviteByHash(hashInviteToken(token)) : null;
    const state = inviteState(invite);
    const org = invite && state === 'open' ? await db.getOrganization(invite.org_id) : null;
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;
    const member = org && userId ? await db.getMembership(org.id, userId) : null;
    const gone = !org || org.status !== 'active' ? GONE[state === 'open' ? 'unknown' : state] : null;

    return (
        <div className="flex min-h-screen flex-col bg-zinc-50">
            <div className="px-6 py-5"><Logo /></div>
            <div className="flex flex-1 items-start justify-center px-4 pt-12 sm:pt-24">
                <div className="w-full max-w-sm rounded-lg border border-zinc-200 bg-white p-8 shadow-card" data-testid="invite-card">
                    {gone ? (
                        <>
                            <h1 className="text-xl font-semibold tracking-tight text-zinc-900">{gone.title}</h1>
                            <p className="mt-2 text-sm text-zinc-600">{gone.body}</p>
                            <Link href="/" className="mt-6 inline-block text-sm text-blue-700 underline">Back to home</Link>
                        </>
                    ) : (
                        <>
                            <h1 className="text-xl font-semibold tracking-tight text-zinc-900">Join {org!.name}</h1>
                            <p className="mt-2 text-sm text-zinc-600">
                                You were invited as {invite!.role === 'owner' ? 'an owner' : 'a member'}. You will see this organization&apos;s projects, tests and results{invite!.role === 'owner' ? ', and can manage the team and projects' : ''}.
                            </p>
                            <div className="mt-6">
                                {member ? (
                                    <Link href="/dashboard" className="inline-flex rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">You are already a member. Open the dashboard</Link>
                                ) : userId ? (
                                    <AcceptInvite token={token} email={session?.user?.email ?? ''} />
                                ) : (
                                    <Link href={`/signin?callbackUrl=${encodeURIComponent(`/invite/${token}`)}`} className="inline-flex rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700" data-testid="invite-signin">Sign in to accept</Link>
                                )}
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
