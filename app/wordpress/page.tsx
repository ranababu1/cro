import type { Metadata } from 'next';
import Link from 'next/link';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { SiteFooter, SiteHeader } from '../components/landing/SiteChrome';

export const metadata: Metadata = { title: 'WordPress plugin', description: 'Add freeabtest.com to your WordPress site in a minute. Install once and run every future test without touching your theme.' };
export const dynamic = 'force-dynamic';

const DOWNLOAD = '/api/downloads/wordpress';

export default async function WordPressPage() {
    const session = await getServerSession(authOptions);
    const signedIn = !!session?.user?.id;
    const back = encodeURIComponent(DOWNLOAD);
    return (
        <div className="min-h-screen bg-[#f8faff] text-zinc-950">
            <SiteHeader />
            <main className="mx-auto max-w-[900px] px-5 pb-20 pt-10 sm:px-8">
                <p className="text-[13px] font-semibold tracking-[0.2em] text-blue-600">WORDPRESS</p>
                <h1 className="mt-4 text-[40px] font-bold tracking-[-0.03em] text-[#0b1630] sm:text-[52px]">A/B testing for WordPress</h1>
                <p className="mt-3 max-w-2xl text-lg text-zinc-600">The FreeABTest plugin adds your snippet to every page. Install it once per site and every future test runs through it, with no theme edits.</p>
                <ul className="mt-8 grid gap-3 text-zinc-700 sm:grid-cols-2">
                    {['Paste your key, or connect in one click from your dashboard', 'Production and Development settings', 'Turn the snippet on or off at any time', 'Loads early and asynchronously to avoid flicker', 'One setting, no extra database work on your pages', 'No tracking of its own'].map((t) => (
                        <li key={t} className="rounded-xl border border-zinc-200 bg-white px-4 py-3">{t}</li>
                    ))}
                </ul>
                <section id="download" className="mt-10 rounded-2xl border border-blue-100 bg-white p-6">
                    <h2 className="text-xl font-semibold text-[#0b1630]">Download the plugin</h2>
                    {signedIn ? (
                        <>
                            <p className="mt-2 text-zinc-600">Upload the zip in WordPress under Plugins, Add New, Upload Plugin, then open Settings, FreeABTest.</p>
                            <a href={DOWNLOAD} className="mt-4 inline-block rounded-lg bg-blue-600 px-5 py-2.5 font-medium text-white hover:bg-blue-700" data-testid="wp-download">Download FreeABTest for WordPress</a>
                        </>
                    ) : (
                        <>
                            <p className="mt-2 text-zinc-600" data-testid="wp-signin-note">The plugin is free for freeabtest.com account holders. Create a free account to download it.</p>
                            <div className="mt-4 flex flex-wrap gap-3">
                                <Link href={`/signin?callbackUrl=${back}`} className="rounded-lg bg-blue-600 px-5 py-2.5 font-medium text-white hover:bg-blue-700">Create free account</Link>
                                <Link href={`/signin?callbackUrl=${back}`} className="rounded-lg border border-zinc-300 px-5 py-2.5 font-medium text-zinc-800 hover:bg-zinc-50">Sign in</Link>
                            </div>
                        </>
                    )}
                </section>
                <section className="mt-10">
                    <h2 className="text-xl font-semibold text-[#0b1630]">Set up in three steps</h2>
                    <ol className="mt-3 list-decimal space-y-2 pl-5 text-zinc-700">
                        <li>Download the plugin and upload it in WordPress under Plugins, Add New, Upload Plugin. Activate it.</li>
                        <li>Open Settings, FreeABTest. Paste your public SDK key, or use Connect WordPress in your dashboard to fill it in.</li>
                        <li>Tick Add the snippet to my site and save. See the <Link className="text-blue-700 hover:underline" href="/docs/install-guides#wordpress">install guide</Link> for details.</li>
                    </ol>
                </section>
            </main>
            <SiteFooter />
        </div>
    );
}
