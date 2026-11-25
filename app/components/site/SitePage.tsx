import { SiteFooter } from './SiteFooter';
import { SiteHeader } from './SiteHeader';

/** Marketing page shell: header, main and footer. */
export function SitePage({ children }: { children: React.ReactNode }) {
    return (
        <div className="min-h-screen bg-white text-navy-950">
            <SiteHeader />
            <main>{children}</main>
            <SiteFooter />
        </div>
    );
}
