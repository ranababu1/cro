import type { Metadata } from 'next';
import Link from 'next/link';
import { SiteFooter, SiteHeader } from '../components/landing/SiteChrome';
import { SITE_URL, formatDate, getAllPosts } from '@/lib/blog';

export const metadata: Metadata = {
    title: 'Blog',
    description: 'Practical guides to A/B testing, sample sizes and experiment results.',
    alternates: { canonical: `${SITE_URL}/blog`, types: { 'application/rss+xml': `${SITE_URL}/blog/rss.xml` } },
    openGraph: { type: 'website', url: `${SITE_URL}/blog`, title: 'Blog · freeabtest.com', description: 'Practical guides to A/B testing.' },
};

export default function BlogIndex() {
    const posts = getAllPosts();
    return (
        <div className="min-h-screen bg-[#f8faff] text-zinc-950">
            <SiteHeader />
            <main className="mx-auto max-w-[860px] px-5 pb-20 pt-10 sm:px-8">
                <p className="text-[13px] font-semibold tracking-[0.2em] text-blue-600">BLOG</p>
                <h1 className="mt-4 text-[40px] font-bold tracking-[-0.03em] text-[#0b1630] sm:text-[52px]">Guides to A/B testing</h1>
                <p className="mt-3 max-w-2xl text-lg text-zinc-600">Plain answers on tools, sample sizes and reading results.</p>
                <ul className="mt-10 space-y-5">
                    {posts.map((p) => (
                        <li key={p.slug} className="rounded-2xl border border-zinc-200 bg-white p-6 transition hover:border-teal-300 hover:shadow-sm">
                            <p className="text-sm text-zinc-500"><time dateTime={p.date}>{formatDate(p.date)}</time> · {p.readingMinutes} min read</p>
                            <h2 className="mt-2 text-xl font-semibold text-[#0b1630]"><Link href={`/blog/${p.slug}`} className="hover:text-blue-700">{p.title}</Link></h2>
                            <p className="mt-2 text-zinc-600">{p.description}</p>
                        </li>
                    ))}
                </ul>
            </main>
            <SiteFooter />
        </div>
    );
}
