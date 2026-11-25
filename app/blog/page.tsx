import type { Metadata } from 'next';
import Link from 'next/link';
import { pageMetadata } from '@/lib/site/meta';
import { Breadcrumbs, SiteFooter, SiteHeader } from '../components/site';
import { SITE_URL, formatDate, getAllPosts } from '@/lib/blog';
import { BlogGrid } from './_components/BlogGrid';
import { CategoryTag, Meta, type CardPost } from './_components/PostCard';

const blogMeta = pageMetadata({
    path: '/blog',
    title: 'Blog',
    description: 'Practical articles on A/B testing: sample sizes, how long to run a test, reading significance and intervals, and test ideas, with the numbers checked.',
});
export const metadata: Metadata = { ...blogMeta, alternates: { canonical: `${SITE_URL}/blog`, types: { 'application/rss+xml': `${SITE_URL}/blog/rss.xml` } } };

export default function BlogIndex() {
    const posts: CardPost[] = getAllPosts().map((p) => ({ slug: p.slug, title: p.title, description: p.description, date: p.date, dateLabel: formatDate(p.date), readingMinutes: p.readingMinutes, category: p.category }));
    const [featured, ...rest] = posts;
    const categories = [...new Set(rest.map((p) => p.category))].sort();
    return (
        <div className="min-h-screen bg-white text-navy-950">
            <SiteHeader />
            <main id="main">
                <header className="border-b border-line bg-surface">
                    <div className="mx-auto max-w-[1200px] px-5 pb-12 pt-10 sm:px-8 sm:pb-16 sm:pt-12">
                        <Breadcrumbs items={[{ href: '/resources', label: 'Resources' }, { href: '/blog', label: 'Blog' }]} />
                        <p className="mt-8 text-[13px] font-semibold uppercase tracking-[0.08em] text-accent-700">Blog</p>
                        <h1 className="mt-3 max-w-[760px] text-[36px] font-semibold leading-[1.1] tracking-[-0.02em] text-navy-950 sm:text-[48px]">Articles on A/B testing</h1>
                        <p className="mt-4 max-w-[640px] text-[18px] leading-[1.6] text-muted-strong">Plain answers on sample sizes, reading results and test ideas, with the numbers checked. Looking for a reading order? Start with the <Link href="/guides" className="font-medium text-accent-700 hover:underline">guides</Link>.</p>
                    </div>
                </header>

                <div className="mx-auto max-w-[1200px] px-5 pb-24 pt-12 sm:px-8 sm:pt-14">
                    {featured && (
                        <article aria-labelledby="featured-title" className="group relative rounded-xl border border-line bg-white p-6 shadow-xs transition hover:border-navy-800/30 focus-within:ring-2 focus-within:ring-accent-600 sm:p-10">
                            <div className="flex items-center gap-3"><span className="text-[12px] font-semibold uppercase tracking-[0.08em] text-muted">Latest</span><CategoryTag>{featured.category}</CategoryTag></div>
                            <h2 id="featured-title" className="mt-4 max-w-[820px] text-[26px] font-semibold leading-tight tracking-[-0.02em] text-navy-950 sm:text-[32px]">
                                <Link href={`/blog/${featured.slug}`} className="after:absolute after:inset-0 focus-visible:outline-none group-hover:underline">{featured.title}</Link>
                            </h2>
                            <p className="mt-3 max-w-[720px] text-[17px] leading-[1.6] text-muted-strong">{featured.description}</p>
                            <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
                                <Meta p={featured} />
                                <span aria-hidden className="inline-flex items-center gap-1.5 text-[15px] font-semibold text-accent-700">Read article <span className="transition-transform group-hover:translate-x-1 motion-reduce:transition-none">→</span></span>
                            </div>
                        </article>
                    )}

                    <BlogGrid posts={rest} categories={categories} />
                </div>
            </main>
            <SiteFooter />
        </div>
    );
}
