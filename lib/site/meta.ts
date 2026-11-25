import type { Metadata } from 'next';
import { SITE_URL } from '@/lib/blog';

/** Default share image for every public page (public/og-default.png, 1200 x 630). */
export const OG_IMAGE = { url: `${SITE_URL}/og-default.png`, width: 1200, height: 630, alt: 'freeabtest.com: Better decisions. Backed by experiments.' };

/** Title, description, canonical, Open Graph and X metadata for a marketing page. `path` starts with a slash. */
export function pageMetadata({ path, title, description }: { path: string; title: string; description: string }): Metadata {
    const url = `${SITE_URL}${path}`;
    const full = `${title} · freeabtest.com`;
    return {
        title,
        description,
        alternates: { canonical: url },
        openGraph: { title: full, description, url, type: 'website', siteName: 'freeabtest.com', images: [OG_IMAGE] },
        twitter: { card: 'summary_large_image', title: full, description, images: [OG_IMAGE.url] },
    };
}
