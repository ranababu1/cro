import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { SiteFooter, SiteHeader } from '../../components/landing/SiteChrome';
import { SITE_URL, formatDate, getAllPosts, getPost, ldJson, renderMarkdown } from '@/lib/blog';

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
    return (
        <div className="min-h-screen bg-[#f8faff] text-zinc-950">
            {p.articleSchema && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldJson(p.articleSchema) }} />}
            {p.faqSchema && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldJson(p.faqSchema) }} />}
            <SiteHeader />
            <main className="mx-auto max-w-[760px] px-5 pb-20 pt-10 sm:px-8">
                <Link href="/blog" className="text-sm font-medium text-blue-600 hover:text-blue-800">← All posts</Link>
                <h1 className="mt-6 text-[34px] font-bold leading-tight tracking-[-0.02em] text-[#0b1630] sm:text-[44px]">{p.title}</h1>
                <p className="mt-4 text-sm text-zinc-500"><time dateTime={p.date}>{formatDate(p.date)}</time> · {p.readingMinutes} min read</p>
                <article className="blog-prose mt-8" dangerouslySetInnerHTML={{ __html: renderMarkdown(p.markdown) }} />
            </main>
            <SiteFooter />
        </div>
    );
}
