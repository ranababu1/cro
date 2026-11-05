import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { Logo } from '../components/ui/Logo';
import { Alert } from '../components/ui';
import GoogleButton from './GoogleButton';
import { turnstileEnabled, turnstileSiteKey } from '@/lib/turnstile';
import { githubEnabled } from '@/lib/auth';

export const metadata: Metadata = { title: 'Sign in' };
export const dynamic = 'force-dynamic';

const errors: Record<string, string> = {
    OAuthAccountNotLinked: 'This email is already linked to another sign-in method.',
    BotCheck: 'We could not confirm you are a person. Complete the check below and try again.',
    SignupLimit: 'We cannot create more new accounts from your network today. Please try again tomorrow. If you already have an account, sign in with it.',
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
                        <h1 className="text-xl font-semibold tracking-tight text-zinc-900">Sign in to freeabtest.com</h1>
                        <p className="mt-1 text-sm text-zinc-500">{githubEnabled() ? 'Use your work Google or GitHub account.' : 'Use your work Google account.'} A workspace is created on first sign-in.</p>
                        {error && <Alert tone="danger" className="mt-5">{errors[error] ?? errors.Default}</Alert>}
                        <div className="mt-6"><GoogleButton callbackUrl={target} siteKey={turnstileEnabled() ? turnstileSiteKey() : null} github={githubEnabled()} /></div>
                        <p className="mt-5 text-xs leading-5 text-zinc-500">
                            By continuing you agree to the <Link href="/legal/terms" className="underline hover:text-zinc-800">Terms of Service</Link> and
                            the <Link href="/legal/privacy" className="underline hover:text-zinc-800">Privacy Policy</Link>.
                        </p>
                    </div>
                    <p className="mt-6 text-center text-xs text-zinc-500">
                        <Link href="/" className="underline hover:text-zinc-800">Back to home</Link>
                    </p>
                </div>
            </div>
        </div>
    );
}
