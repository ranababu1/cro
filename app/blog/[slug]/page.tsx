import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { JsonLd, SiteFooter, SiteHeader } from '../../components/site';
import { SITE_URL, formatDate, getAllPosts, getPost, relatedPosts, renderPost } from '@/lib/blog';
import { parseSchema } from '@/lib/site/jsonLd';
import { OG_IMAGE } from '@/lib/site/meta';
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
        openGraph: { type: 'article', url, title: p.title, description: p.description, publishedTime: p.date, modifiedTime: p.updated, siteName: 'freeabtest.com', images: [OG_IMAGE] },
        twitter: { card: 'summary_large_image', title: p.title, description: p.description, images: [OG_IMAGE.url] },
    };
}

export default async function BlogPost({ params }: { params: Promise<{ slug: string }> }) {
    const p = getPost((await params).slug);
    if (!p) notFound();
    const { html, afterFaqHtml, toc, faq, faqHeading } = renderPost(p.markdown);
    const related = relatedPosts(p, getAllPosts()).map((r) => ({ slug: r.slug, title: r.title, description: r.description, date: r.date, dateLabel: formatDate(r.date), readingMinutes: r.readingMinutes, category: r.category }));
    return (
        <div className="min-h-screen bg-canvas text-navy-950">
            <JsonLd extra={[...parseSchema(p.articleSchema), ...parseSchema(p.faqSchema), ...parseSchema(p.breadcrumbSchema), ...parseSchema(p.howtoSchema), ...parseSchema(p.itemListSchema)]} />
            <ReadingProgress target="article-body" />
            <SiteHeader />
            <main id="main">
                <header className="border-b border-line">
                    <div className="mx-auto max-w-[1360px] px-5 pb-12 pt-10 sm:px-8 sm:pt-14">
                        <div className="xl:pr-[288px]">
                        <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-[14px] text-muted">
                            <Link href="/blog" className="font-medium text-accent-700 hover:text-accent-800">Blog</Link><span aria-hidden>/</span><span>{p.category}</span>
                        </nav>
                        <div className="mt-6"><CategoryTag>{p.category}</CategoryTag></div>
                        <h1 className="mt-4 text-[34px] font-bold leading-[1.12] tracking-[-0.03em] text-navy-950 sm:text-[46px]">{p.title}</h1>
                        <p className="mt-5 text-[19px] leading-relaxed text-muted-strong">{p.description}</p>
                        <div className="mt-8 flex items-center gap-3">
                            <span aria-hidden className="grid h-10 w-10 place-items-center rounded-full bg-accent-700 text-[15px] font-semibold text-white">{p.authorName.charAt(0)}</span>
                            <div className="text-[14px] leading-tight">
                                <p className="font-semibold text-navy-950">{p.authorName}</p>
                                <p className="mt-1 text-muted"><time dateTime={p.date}>{formatDate(p.date)}</time><span aria-hidden className="mx-2">·</span>{p.readingMinutes} min read</p>
                            </div>
                        </div>
                        </div>
                    </div>
                </header>

                <div className="mx-auto grid max-w-[1360px] gap-12 px-5 pt-12 sm:px-8 xl:grid-cols-[minmax(0,1fr)_240px]">
                    <div id="article-body" className="w-full min-w-0 xl:max-w-[1040px]">
                        {toc.length > 2 && (
                            <details className="toc-mobile mb-10 rounded-xl border border-line bg-white xl:hidden">
                                <summary className="cursor-pointer select-none px-5 py-3.5 text-[15px] font-semibold text-navy-950">On this page</summary>
                                <ol className="space-y-2 px-5 pb-4 text-[15px]">{toc.map((t) => <li key={t.id}><a href={`#${t.id}`} className="text-muted-strong hover:text-accent-700">{t.text}</a></li>)}</ol>
                            </details>
                        )}
                        <article className="blog-prose" dangerouslySetInnerHTML={{ __html: html }} />
                        {faq.length > 0 && (
                            <section aria-labelledby="faq" className="mt-14">
                                <h2 id="faq" className="scroll-mt-24 text-[28px] font-bold tracking-[-0.02em] text-navy-950">{faqHeading}</h2>
                                <div className="mt-6 divide-y divide-line rounded-2xl border border-line bg-white">
                                    {faq.map((f) => (
                                        <details key={f.q} className="faq-item group">
                                            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-[17px] font-semibold text-navy-950 hover:text-accent-700 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent-700 sm:px-6">
                                                {f.q}
                                                <span aria-hidden className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-accent-50 text-accent-700 transition-transform group-open:rotate-45 motion-reduce:transition-none">+</span>
                                            </summary>
                                            <div className="blog-prose blog-prose-tight px-5 pb-5 sm:px-6" dangerouslySetInnerHTML={{ __html: f.a }} />
                                        </details>
                                    ))}
                                </div>
                            </section>
                        )}
                        {afterFaqHtml && <div className="blog-prose mt-10" dangerouslySetInnerHTML={{ __html: afterFaqHtml }} />}

                        <aside aria-label="Try freeabtest.com" className="mt-16 rounded-2xl border border-accent-100 bg-white p-7 shadow-site sm:p-8">
                            <p className="text-[20px] font-semibold tracking-[-0.01em] text-navy-950">Run your first A/B test for free</p>
                            <p className="mt-2 text-[16px] leading-relaxed text-muted-strong">Paste one script tag, create a test, and get results you can explain. No card needed.</p>
                            <Link href="/signin" className="mt-5 inline-flex h-11 items-center gap-2 rounded-lg bg-navy-950 px-5 text-[15px] font-medium text-white hover:bg-navy-800 hover:shadow-site-btn focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-700">Start free <span aria-hidden>→</span></Link>
                        </aside>
                    </div>
                    {toc.length > 2 && (
                        <aside className="hidden xl:block"><div className="sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto pb-6"><Toc items={toc} /></div></aside>
                    )}
                </div>

                {related.length > 0 && (
                    <section aria-labelledby="related" className="mt-24 border-t border-line">
                        <div className="mx-auto max-w-[1180px] px-5 py-16 sm:px-8">
                            <h2 id="related" className="text-[24px] font-bold tracking-[-0.02em] text-navy-950">Keep reading</h2>
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
