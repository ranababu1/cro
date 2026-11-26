import { ldJson } from '@/lib/blog';
import { siteGraph } from '@/lib/site/jsonLd';

/** Single JSON-LD script for a page: Organization, WebSite and any extra nodes in one @graph. */
export function JsonLd({ extra = [] }: { extra?: unknown[] }) {
    return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldJson(JSON.stringify(siteGraph(extra))) }} />;
}
