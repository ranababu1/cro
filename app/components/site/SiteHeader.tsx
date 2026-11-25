import Link from 'next/link';
import { Logo } from '../ui/Logo';
import { ArrowIcon } from './Buttons';
import { MegaNav } from './MegaNav';
import { MobileMenu } from './MobileMenu';
import { SIGN_IN_HREF, START_HREF } from './nav';

/** Marketing header. Solid background on purpose: a backdrop filter would trap the fixed mobile menu inside the header box.
 *  Separate from the signed-in app shell (app/components/shell), which has its own navigation. */
export function SiteHeader() {
    return (
        <header data-site-header className="sticky top-0 z-50 border-b border-line bg-white">
            <a href="#main" className="sr-only rounded-lg bg-navy-950 px-4 py-2 text-[14px] font-medium text-white focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[60] focus:px-4 focus:py-2">Skip to content</a>
            <div className="relative">
                <div className="mx-auto flex h-[72px] max-w-[1200px] items-center gap-6 px-5 sm:px-8">
                    <Logo size="lg" />
                    <div className="ml-4 hidden lg:block"><MegaNav /></div>
                    <div className="ml-auto flex items-center gap-2 sm:gap-3">
                        <Link href={SIGN_IN_HREF} className="hidden h-10 items-center rounded-lg px-3 text-[15px] font-medium text-muted-strong hover:text-navy-950 focus-visible:outline-2 focus-visible:outline-accent-700 sm:inline-flex">Sign in</Link>
                        <Link href={START_HREF} className="hidden h-10 items-center gap-2 rounded-lg bg-navy-950 px-4 text-[15px] font-medium text-white hover:bg-navy-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-700 min-[400px]:inline-flex">Start for free <ArrowIcon /></Link>
                        <MobileMenu />
                    </div>
                </div>
            </div>
        </header>
    );
}
