import { pageMetadata } from '@/lib/site/meta';
import Link from 'next/link';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { canDownloadPlugin } from '@/lib/pluginDownload';
import { Breadcrumbs, SiteFooter, SiteHeader, JsonLd } from '../components/site';
import { breadcrumbListNode } from '@/lib/site/jsonLd';

export const metadata = pageMetadata({
    path: '/wordpress',
    title: 'WordPress plugin',
    description: 'The FreeABTest WordPress plugin for paid plans. Install once and run every future test without touching your theme.',
});
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
        <div className="min-h-screen bg-canvas text-navy-950">
            <JsonLd extra={[breadcrumbListNode([{ href: '/wordpress', label: 'WordPress plugin' }])]} />
            <SiteHeader />
            <main id="main" className="mx-auto max-w-[900px] px-5 pb-20 pt-10 sm:px-8">
                <Breadcrumbs items={[{ href: '/wordpress', label: 'WordPress plugin' }]} />
                <p className="mt-8 text-[13px] font-semibold uppercase tracking-[0.08em] text-accent-700">WordPress</p>
                <h1 className="mt-4 text-[36px] font-semibold leading-[1.1] tracking-[-0.02em] text-navy-950 sm:text-[48px]">A/B testing for WordPress</h1>
                <p className="mt-3 max-w-2xl text-[18px] leading-[1.6] text-muted-strong">The FreeABTest plugin adds your snippet to every page. Install it once per site and every future test runs through it, with no theme edits.</p>
                <p className="mt-3 inline-block rounded-full bg-surface px-3 py-1 text-[13px] font-medium text-muted-strong ring-1 ring-inset ring-line">Available on paid plans</p>
                <ul className="mt-8 grid grid-cols-1 gap-3 text-muted-strong sm:grid-cols-2">
                    {['Connect in one click from your dashboard, or paste your key', 'Production and Development settings', 'Turn the snippet on or off at any time', 'Loads early and asynchronously to avoid flicker', 'No extra database work on your pages', 'Works only on your registered domains'].map((t) => (
                        <li key={t} className="rounded-xl border border-line bg-white px-4 py-3 shadow-xs">{t}</li>
                    ))}
                </ul>
                <section id="download" className="mt-10 rounded-xl border border-line bg-surface p-6">
                    <h2 className="text-[22px] font-semibold tracking-[-0.01em] text-navy-950">Download the plugin</h2>
                    {allowed ? (
                        <>
                            <p className="mt-2 text-muted-strong">Upload the zip in WordPress under Plugins, Add New, Upload Plugin, then open Settings, FreeABTest.</p>
                            {limited && <p className="mt-2 text-amber-800" data-testid="wp-limit-note">You have downloaded the plugin several times in a short while. Please try again later.</p>}
                            <a href={DOWNLOAD} className="mt-4 inline-block rounded-lg bg-navy-950 px-5 py-2.5 font-medium text-white hover:bg-navy-800" data-testid="wp-download">Download FreeABTest for WordPress</a>
                        </>
                    ) : signedIn ? (
                        <>
                            <p className="mt-2 text-muted-strong" data-testid="wp-upgrade-note">The WordPress plugin is available to paid users only. Upgrade to Starter or above to download it and connect your site.</p>
                            <div className="mt-4 flex flex-wrap gap-3">
                                <Link href="/pricing" className="rounded-lg bg-navy-950 px-5 py-2.5 font-medium text-white hover:bg-navy-800" data-testid="wp-upgrade">See paid plans</Link>
                                <Link href="/docs/install-guides#wordpress" className="rounded-lg border border-line bg-white px-5 py-2.5 font-medium text-navy-950 hover:bg-surface">Install without the plugin</Link>
                            </div>
                        </>
                    ) : (
                        <>
                            <p className="mt-2 text-muted-strong" data-testid="wp-signin-note">The WordPress plugin is available to paid users only. Create an account and choose a paid plan to download it. Already on a paid plan? Sign in.</p>
                            <div className="mt-4 flex flex-wrap gap-3">
                                <Link href={`/signin?callbackUrl=${back}`} className="rounded-lg bg-navy-950 px-5 py-2.5 font-medium text-white hover:bg-navy-800" data-testid="wp-signup">Create account</Link>
                                <Link href={`/signin?callbackUrl=${back}`} className="rounded-lg border border-line bg-white px-5 py-2.5 font-medium text-navy-950 hover:bg-surface">Sign in</Link>
                            </div>
                        </>
                    )}
                </section>
                <section className="mt-10">
                    <h2 className="text-[22px] font-semibold tracking-[-0.01em] text-navy-950">Set up in three steps</h2>
                    <ol className="mt-3 list-decimal space-y-2 pl-5 text-muted-strong">
                        <li>Download the plugin and upload it in WordPress under Plugins, Add New, Upload Plugin. Activate it.</li>
                        <li>Open Settings, FreeABTest. Use Connect WordPress in your dashboard to fill in your key, or paste your public SDK key. The site must be one of your registered domains.</li>
                        <li>Tick Add the snippet to my site and save. The plugin checks the key and shows Connected when it is ready. See the <Link className="font-medium text-accent-700 underline underline-offset-2" href="/docs/install-guides#wordpress">install guide</Link> for details.</li>
                    </ol>
                </section>
            </main>
            <SiteFooter />
        </div>
    );
}
