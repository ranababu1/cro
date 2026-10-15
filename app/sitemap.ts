import type { MetadataRoute } from 'next';
import { SITE_URL, getAllPosts } from '@/lib/blog';

export default function sitemap(): MetadataRoute.Sitemap {
    const pages = ['', '/pricing', '/roadmap', '/docs', '/blog'].map((p) => ({ url: `${SITE_URL}${p}` }));
    const posts = getAllPosts().map((p) => ({ url: `${SITE_URL}/blog/${p.slug}`, lastModified: p.updated }));
    return [...pages, ...posts];
}
