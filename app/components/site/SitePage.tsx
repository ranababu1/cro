import { JsonLd } from './JsonLd';
import { SiteFooter } from './SiteFooter';
import { SiteHeader } from './SiteHeader';

/** Marketing page shell: header, main and footer, plus one JSON-LD graph. */
export function SitePage({ children, schema }: { children: React.ReactNode; schema?: unknown[] }) {
    return (
        <div className="min-h-screen bg-canvas text-navy-950">
            <JsonLd extra={schema} />
            <SiteHeader />
            <main id="main">{children}</main>
            <SiteFooter />
        </div>
    );
}
