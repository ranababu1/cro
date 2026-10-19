import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { SiteFooter, SiteHeader } from '../../components/landing/SiteChrome';
import { SITE_URL, formatDate, getAllPosts, getPost, ldJson, relatedPosts, renderPost } from '@/lib/blog';
import { CategoryTag, PostCard } from '../_components/PostCard';
import { ReadingProgress } from '../_components/ReadingProgress';
import { Toc } from '../_components/Toc';

export const dynamicParams = false;
export const generateStaticParams = () => getAllPosts().map((p) => ({ slug: p.slug }));

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
    const p = getPost((await params).slug);
    if (!p) return {};
    const url = `${SITE_URL}/blog/${p.slug}`;
    return {
        title: { absolute: p.title }, description: p.description, keywords: p.keywords, authors: [{ name: p.author }],
        alternates: { canonical: url },
        openGraph: { type: 'article', url, title: p.title, description: p.description, publishedTime: p.date, modifiedTime: p.updated, siteName: 'freeabtest.com' },
        twitter: { card: 'summary_large_image', title: p.title, description: p.description },
    };
}

export default async function BlogPost({ params }: { params: Promise<{ slug: string }> }) {
    const p = getPost((await params).slug);
    if (!p) notFound();
    const { html, afterFaqHtml, toc, faq, faqHeading } = renderPost(p.markdown);
    const related = relatedPosts(p, getAllPosts()).map((r) => ({ slug: r.slug, title: r.title, description: r.description, date: r.date, dateLabel: formatDate(r.date), readingMinutes: r.readingMinutes, category: r.category }));
    return (
        <div className="min-h-screen bg-white text-zinc-950">
            {p.articleSchema && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldJson(p.articleSchema) }} />}
            {p.faqSchema && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldJson(p.faqSchema) }} />}
            {p.breadcrumbSchema && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldJson(p.breadcrumbSchema) }} />}
            <ReadingProgress target="article-body" />
            <SiteHeader />
            <main>
                <header className="border-b border-zinc-100 bg-gradient-to-b from-[#f8faff] to-white">
                    <div className="mx-auto max-w-[720px] px-5 pb-12 pt-10 sm:px-8 sm:pt-14">
                        <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-[14px] text-zinc-500">
                            <Link href="/blog" className="font-medium text-blue-700 hover:text-blue-900">Blog</Link><span aria-hidden>/</span><span>{p.category}</span>
                        </nav>
                        <div className="mt-6"><CategoryTag>{p.category}</CategoryTag></div>
                        <h1 className="mt-4 text-[34px] font-bold leading-[1.12] tracking-[-0.03em] text-[#0b1630] sm:text-[46px]">{p.title}</h1>
                        <p className="mt-5 text-[19px] leading-relaxed text-zinc-600">{p.description}</p>
                        <div className="mt-8 flex items-center gap-3">
                            <span aria-hidden className="grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-blue-600 to-teal-500 text-[15px] font-semibold text-white">{p.authorName.charAt(0)}</span>
                            <div className="text-[14px] leading-tight">
                                <p className="font-semibold text-[#0b1630]">{p.authorName}</p>
                                <p className="mt-1 text-zinc-500"><time dateTime={p.date}>{formatDate(p.date)}</time><span aria-hidden className="mx-2">·</span>{p.readingMinutes} min read</p>
                            </div>
                        </div>
                    </div>
                </header>

                <div className="mx-auto grid max-w-[1180px] gap-12 px-5 pt-12 sm:px-8 xl:grid-cols-[1fr_minmax(0,720px)_1fr]">
                    <div className="hidden xl:block" />
                    <div id="article-body" className="min-w-0">
                        {toc.length > 2 && (
                            <details className="toc-mobile mb-10 rounded-xl border border-zinc-200 bg-[#f8faff] xl:hidden">
                                <summary className="cursor-pointer select-none px-5 py-3.5 text-[15px] font-semibold text-[#0b1630]">On this page</summary>
                                <ol className="space-y-2 px-5 pb-4 text-[15px]">{toc.map((t) => <li key={t.id}><a href={`#${t.id}`} className="text-zinc-700 hover:text-blue-700">{t.text}</a></li>)}</ol>
                            </details>
                        )}
                        <article className="blog-prose" dangerouslySetInnerHTML={{ __html: html }} />
                        {faq.length > 0 && (
                            <section aria-labelledby="faq" className="mt-14">
                                <h2 id="faq" className="scroll-mt-24 text-[28px] font-bold tracking-[-0.02em] text-[#0b1630]">{faqHeading}</h2>
                                <div className="mt-6 divide-y divide-zinc-200 rounded-2xl border border-zinc-200">
                                    {faq.map((f) => (
                                        <details key={f.q} className="faq-item group">
                                            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-[17px] font-semibold text-[#0b1630] hover:text-blue-700 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue-600 sm:px-6">
                                                {f.q}
                                                <span aria-hidden className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-blue-50 text-blue-700 transition-transform group-open:rotate-45 motion-reduce:transition-none">+</span>
                                            </summary>
                                            <div className="blog-prose blog-prose-tight px-5 pb-5 sm:px-6" dangerouslySetInnerHTML={{ __html: f.a }} />
                                        </details>
                                    ))}
                                </div>
                            </section>
                        )}
                        {afterFaqHtml && <div className="blog-prose mt-10" dangerouslySetInnerHTML={{ __html: afterFaqHtml }} />}

                        <aside aria-label="Try freeabtest.com" className="mt-16 rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 to-teal-50/60 p-7 sm:p-8">
                            <p className="text-[20px] font-semibold tracking-[-0.01em] text-[#0b1630]">Run your first A/B test for free</p>
                            <p className="mt-2 text-[16px] leading-relaxed text-zinc-600">Paste one script tag, create a test, and get results you can explain. No card needed.</p>
                            <Link href="/signin" className="mt-5 inline-flex h-11 items-center gap-2 rounded-xl bg-[#0b1630] px-5 text-[15px] font-medium text-white hover:bg-[#13224a] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">Start free <span aria-hidden>→</span></Link>
                        </aside>
                    </div>
                    {toc.length > 2 && (
                        <aside className="hidden xl:block"><div className="sticky top-10 max-h-[calc(100vh-5rem)] overflow-y-auto pb-6"><Toc items={toc} /></div></aside>
                    )}
                </div>

                {related.length > 0 && (
                    <section aria-labelledby="related" className="mt-24 border-t border-zinc-100 bg-[#f8faff]">
                        <div className="mx-auto max-w-[1180px] px-5 py-16 sm:px-8">
                            <h2 id="related" className="text-[24px] font-bold tracking-[-0.02em] text-[#0b1630]">Keep reading</h2>
                            <ul className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">{related.map((r) => <li key={r.slug}><PostCard p={r} /></li>)}</ul>
                        </div>
                    </section>
                )}
                <div className="h-20" />
            </main>
            <SiteFooter />
        </div>
    );
}
