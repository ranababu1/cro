import { buildRss, getAllPosts } from '@/lib/blog';

export const dynamic = 'force-static';

export function GET() {
    return new Response(buildRss(getAllPosts()), { headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' } });
}
