import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/blog';

/** Public marketing, docs, blog and legal pages are indexed; the app, API, share and invite links are not. */
export default function robots(): MetadataRoute.Robots {
    return {
        rules: [{
            userAgent: '*',
            allow: '/',
            disallow: ['/api/', '/dashboard', '/experiments', '/planner', '/traffic', '/heatmaps', '/popups', '/surveys', '/settings', '/support', '/onboarding', '/share/', '/invite/', '/admin'],
        }],
        sitemap: `${SITE_URL}/sitemap.xml`,
    };
}
