import type { Metadata } from 'next';
import Link from 'next/link';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { canDownloadPlugin } from '@/lib/pluginDownload';
import { SiteFooter, SiteHeader } from '../components/landing/SiteChrome';

export const metadata: Metadata = { title: 'WordPress plugin', description: 'The FreeABTest WordPress plugin for paid plans. Install once and run every future test without touching your theme.' };
export const dynamic = 'force-dynamic';

const DOWNLOAD = '/api/downloads/wordpress';

export default async function WordPressPage({ searchParams }: { searchParams: Promise<{ download?: string }> }) {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;
    const signedIn = !!userId;
    const allowed = userId ? await canDownloadPlugin(userId, session?.user?.email ?? null) : false;
    const limited = (await searchParams).download === 'limit';
    const back = encodeURIComponent(DOWNLOAD);
    return (
        <div className="min-h-screen bg-[#f8faff] text-zinc-950">
            <SiteHeader />
            <main className="mx-auto max-w-[900px] px-5 pb-20 pt-10 sm:px-8">
                <p className="text-[13px] font-semibold tracking-[0.2em] text-blue-600">WORDPRESS</p>
                <h1 className="mt-4 text-[40px] font-bold tracking-[-0.03em] text-[#0b1630] sm:text-[52px]">A/B testing for WordPress</h1>
                <p className="mt-3 max-w-2xl text-lg text-zinc-600">The FreeABTest plugin adds your snippet to every page. Install it once per site and every future test runs through it, with no theme edits.</p>
                <p className="mt-3 inline-block rounded-full bg-blue-50 px-3 py-1 text-sm font-medium text-blue-800">Available on paid plans</p>
                <ul className="mt-8 grid gap-3 text-zinc-700 sm:grid-cols-2">
                    {['Connect in one click from your dashboard, or paste your key', 'Production and Development settings', 'Turn the snippet on or off at any time', 'Loads early and asynchronously to avoid flicker', 'No extra database work on your pages', 'Works only on your registered domains'].map((t) => (
                        <li key={t} className="rounded-xl border border-zinc-200 bg-white px-4 py-3">{t}</li>
                    ))}
                </ul>
                <section id="download" className="mt-10 rounded-2xl border border-blue-100 bg-white p-6">
                    <h2 className="text-xl font-semibold text-[#0b1630]">Download the plugin</h2>
                    {allowed ? (
                        <>
                            <p className="mt-2 text-zinc-600">Upload the zip in WordPress under Plugins, Add New, Upload Plugin, then open Settings, FreeABTest.</p>
                            {limited && <p className="mt-2 text-amber-800" data-testid="wp-limit-note">You have downloaded the plugin several times in a short while. Please try again later.</p>}
                            <a href={DOWNLOAD} className="mt-4 inline-block rounded-lg bg-blue-600 px-5 py-2.5 font-medium text-white hover:bg-blue-700" data-testid="wp-download">Download FreeABTest for WordPress</a>
                        </>
                    ) : signedIn ? (
                        <>
                            <p className="mt-2 text-zinc-600" data-testid="wp-upgrade-note">The WordPress plugin is available to paid users only. Upgrade to Starter or above to download it and connect your site.</p>
                            <div className="mt-4 flex flex-wrap gap-3">
                                <Link href="/pricing" className="rounded-lg bg-blue-600 px-5 py-2.5 font-medium text-white hover:bg-blue-700" data-testid="wp-upgrade">See paid plans</Link>
                                <Link href="/docs/install-guides#wordpress" className="rounded-lg border border-zinc-300 px-5 py-2.5 font-medium text-zinc-800 hover:bg-zinc-50">Install without the plugin</Link>
                            </div>
                        </>
                    ) : (
                        <>
                            <p className="mt-2 text-zinc-600" data-testid="wp-signin-note">The WordPress plugin is available to paid users only. Create an account and choose a paid plan to download it. Already on a paid plan? Sign in.</p>
                            <div className="mt-4 flex flex-wrap gap-3">
                                <Link href={`/signin?callbackUrl=${back}`} className="rounded-lg bg-blue-600 px-5 py-2.5 font-medium text-white hover:bg-blue-700" data-testid="wp-signup">Create account</Link>
                                <Link href={`/signin?callbackUrl=${back}`} className="rounded-lg border border-zinc-300 px-5 py-2.5 font-medium text-zinc-800 hover:bg-zinc-50">Sign in</Link>
                            </div>
                        </>
                    )}
                </section>
                <section className="mt-10">
                    <h2 className="text-xl font-semibold text-[#0b1630]">Set up in three steps</h2>
                    <ol className="mt-3 list-decimal space-y-2 pl-5 text-zinc-700">
                        <li>Download the plugin and upload it in WordPress under Plugins, Add New, Upload Plugin. Activate it.</li>
                        <li>Open Settings, FreeABTest. Use Connect WordPress in your dashboard to fill in your key, or paste your public SDK key. The site must be one of your registered domains.</li>
                        <li>Tick Add the snippet to my site and save. The plugin checks the key and shows Connected when it is ready. See the <Link className="text-blue-700 hover:underline" href="/docs/install-guides#wordpress">install guide</Link> for details.</li>
                    </ol>
                </section>
            </main>
            <SiteFooter />
        </div>
    );
}
