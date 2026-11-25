import type { MetadataRoute } from 'next';
import { SITE_URL, getAllPosts } from '@/lib/blog';

export default function sitemap(): MetadataRoute.Sitemap {
    const pages = ['', '/product', '/features', '/how-it-works', '/experiment-analytics', '/pricing', '/wordpress', '/docs', '/blog', '/about', '/contact', '/security', '/legal/terms', '/legal/privacy', '/legal/dpa', '/legal/cookies', '/legal/refunds', '/legal/delivery'].map((p) => ({ url: `${SITE_URL}${p}` }));
    const posts = getAllPosts().map((p) => ({ url: `${SITE_URL}/blog/${p.slug}`, lastModified: p.updated }));
    return [...pages, ...posts];
}
