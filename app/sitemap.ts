import type { MetadataRoute } from 'next';
import { SITE_URL, getAllPosts } from '@/lib/blog';
import { docPages } from '@/lib/docs';

export default function sitemap(): MetadataRoute.Sitemap {
    const pages = ['', '/product', '/features', '/how-it-works', '/experiment-analytics', '/solutions', '/solutions/marketing', '/solutions/saas', '/solutions/ecommerce', '/solutions/startups', '/developers', '/statistical-methodology', '/pricing', '/wordpress', '/docs', '/blog', '/about', '/contact', '/security', '/legal/terms', '/legal/privacy', '/legal/dpa', '/legal/cookies', '/legal/refunds', '/legal/delivery'].map((p) => ({ url: `${SITE_URL}${p}` }));
    const docs = docPages.filter((p) => p.slug !== 'introduction').map((p) => ({ url: `${SITE_URL}/docs/${p.slug}` }));
    const posts = getAllPosts().map((p) => ({ url: `${SITE_URL}/blog/${p.slug}`, lastModified: p.updated }));
    return [...pages, ...docs, ...posts];
}
