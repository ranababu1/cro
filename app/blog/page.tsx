import type { Metadata } from 'next';
import Link from 'next/link';
import { SiteFooter, SiteHeader } from '../components/landing/SiteChrome';
import { SITE_URL, formatDate, getAllPosts } from '@/lib/blog';
import { BlogGrid } from './_components/BlogGrid';
import { CategoryTag, Meta, type CardPost } from './_components/PostCard';

export const metadata: Metadata = {
    title: 'Blog',
    description: 'Practical guides to A/B testing, sample sizes and experiment results.',
    alternates: { canonical: `${SITE_URL}/blog`, types: { 'application/rss+xml': `${SITE_URL}/blog/rss.xml` } },
    openGraph: { type: 'website', url: `${SITE_URL}/blog`, title: 'Blog · freeabtest.com', description: 'Practical guides to A/B testing.' },
};

export default function BlogIndex() {
    const posts: CardPost[] = getAllPosts().map((p) => ({ slug: p.slug, title: p.title, description: p.description, date: p.date, dateLabel: formatDate(p.date), readingMinutes: p.readingMinutes, category: p.category }));
    const [featured, ...rest] = posts;
    const categories = [...new Set(rest.map((p) => p.category))].sort();
    return (
        <div className="min-h-screen bg-[#f8faff] text-zinc-950">
            <SiteHeader />
            <main className="mx-auto max-w-[1180px] px-5 pb-28 pt-12 sm:px-8 sm:pt-16">
                <header className="max-w-2xl">
                    <p className="text-[13px] font-semibold tracking-[0.2em] text-blue-600">BLOG</p>
                    <h1 className="mt-4 text-[38px] font-bold leading-[1.08] tracking-[-0.03em] text-[#0b1630] sm:text-[54px]">Guides to A/B testing</h1>
                    <p className="mt-5 text-[18px] leading-relaxed text-zinc-600">Plain answers on tools, sample sizes and reading results. No fluff, numbers checked.</p>
                </header>

                {featured && (
                    <article aria-labelledby="featured-title" className="group relative mt-14 overflow-hidden rounded-3xl border border-zinc-200/80 bg-white shadow-[0_1px_2px_rgb(16_24_40/0.04)] transition-shadow duration-200 focus-within:ring-2 focus-within:ring-blue-500 hover:shadow-[0_24px_48px_-24px_rgb(37_99_235/0.3)] motion-reduce:transition-none">
                        <div className="grid md:grid-cols-[1.25fr_1fr]">
                            <div className="p-7 sm:p-10 lg:p-12">
                                <div className="flex items-center gap-3"><span className="text-[12px] font-semibold uppercase tracking-[0.14em] text-blue-600">Latest</span><CategoryTag>{featured.category}</CategoryTag></div>
                                <h2 id="featured-title" className="mt-5 text-[28px] font-bold leading-tight tracking-[-0.02em] text-[#0b1630] sm:text-[36px]">
                                    <Link href={`/blog/${featured.slug}`} className="after:absolute after:inset-0 focus-visible:outline-none group-hover:text-blue-700">{featured.title}</Link>
                                </h2>
                                <p className="mt-4 text-[17px] leading-relaxed text-zinc-600">{featured.description}</p>
                                <div className="mt-8 flex items-center justify-between gap-4">
                                    <Meta p={featured} />
                                    <span aria-hidden className="inline-flex items-center gap-1.5 text-[15px] font-semibold text-blue-700">Read article <span className="transition-transform group-hover:translate-x-1 motion-reduce:transition-none">→</span></span>
                                </div>
                            </div>
                            <div aria-hidden className="relative hidden min-h-[280px] overflow-hidden bg-gradient-to-br from-blue-50 via-white to-teal-50 md:block">
                                <div className="absolute inset-0 [background-image:radial-gradient(rgb(37_99_235/0.12)_1px,transparent_1px)] [background-size:18px_18px]" />
                                <div className="absolute left-1/2 top-1/2 w-[72%] -translate-x-1/2 -translate-y-1/2 space-y-4">
                                    {[['A', 'Control', '3.0%', 'w-[46%]', 'bg-zinc-300'], ['B', 'Variation', '3.6%', 'w-[58%]', 'bg-gradient-to-r from-blue-600 to-teal-500']].map(([k, n, v, w, c]) => (
                                        <div key={k} className="rounded-xl bg-white/90 p-4 shadow-sm ring-1 ring-zinc-200/70">
                                            <div className="flex justify-between text-[13px]"><span className="font-semibold text-[#0b1630]">{k} · {n}</span><span className="font-mono text-zinc-600">{v}</span></div>
                                            <div className="mt-2.5 h-2 rounded-full bg-zinc-100"><div className={`h-2 rounded-full ${w} ${c}`} /></div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </article>
                )}

                <BlogGrid posts={rest} categories={categories} />
            </main>
            <SiteFooter />
        </div>
    );
}
