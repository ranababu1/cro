import type { Metadata } from 'next';
import { SITE_URL } from '@/lib/blog';

/** Title, description, canonical, Open Graph and X metadata for a marketing page. `path` starts with a slash. */
export function pageMetadata({ path, title, description }: { path: string; title: string; description: string }): Metadata {
    const url = `${SITE_URL}${path}`;
    const full = `${title} · freeabtest.com`;
    return {
        title,
        description,
        alternates: { canonical: url },
        openGraph: { title: full, description, url, type: 'website', siteName: 'freeabtest.com' },
        twitter: { card: 'summary', title: full, description },
    };
}
