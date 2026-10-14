import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { Logo } from '../components/ui/Logo';
import { Alert } from '../components/ui';
import GoogleButton from './GoogleButton';

export const metadata: Metadata = { title: 'Sign in' };

const errors: Record<string, string> = {
    OAuthAccountNotLinked: 'This email is already linked to another sign-in method.',
    AccessDenied: 'Access was denied. Try another account.',
    Default: 'Sign-in failed. Please try again.',
};

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ callbackUrl?: string; error?: string }> }) {
    const { callbackUrl, error } = await searchParams;
    const session = await getServerSession(authOptions);
    // Only allow relative callback URLs.
    const target = callbackUrl?.startsWith('/') && !callbackUrl.startsWith('//') ? callbackUrl : '/dashboard';
    if (session?.user) redirect(target);

    return (
        <div className="flex min-h-screen flex-col bg-zinc-50">
            <div className="px-6 py-5"><Logo /></div>
            <div className="flex flex-1 items-start justify-center px-4 pt-12 sm:pt-24">
                <div className="w-full max-w-sm">
                    <div className="rounded-lg border border-zinc-200 bg-white p-8 shadow-card">
                        <h1 className="text-xl font-semibold tracking-tight text-zinc-900">Sign in to CRO</h1>
                        <p className="mt-1 text-sm text-zinc-500">Use your work Google account. A workspace is created on first sign-in.</p>
                        {error && <Alert tone="danger" className="mt-5">{errors[error] ?? errors.Default}</Alert>}
                        <div className="mt-6"><GoogleButton callbackUrl={target} /></div>
                    </div>
                    <p className="mt-6 text-center text-xs text-zinc-500">
                        <Link href="/" className="underline hover:text-zinc-800">Back to home</Link>
                    </p>
                </div>
            </div>
        </div>
    );
}
