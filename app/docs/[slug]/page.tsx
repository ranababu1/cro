import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { docPages, getDocPage } from '@/lib/docs';
import { DocArticle } from '../_components/DocArticle';

type Params = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
    return docPages.map((p) => ({ slug: p.slug }));
}

export const dynamicParams = false;

export async function generateMetadata({ params }: Params): Promise<Metadata> {
    const page = getDocPage((await params).slug);
    return page ? { title: page.title, description: page.description } : {};
}

export default async function DocPageRoute({ params }: Params) {
    const page = getDocPage((await params).slug);
    if (!page) notFound();
    return <DocArticle page={page} />;
}
