import Link from 'next/link';
import { Logo } from '../ui/Logo';
import { NavMenu } from './NavMenu';

const menus = {
    Product: [
        { href: '/#how-it-works', title: 'How it works', body: 'From idea to result in three steps' },
        { href: '/roadmap', title: 'Features and roadmap', body: 'What works today and what is next' },
        { href: '/demo.html', title: 'Demo page', body: 'See the SDK on a sample page' },
    ],
    'Use cases': [
        { href: '/#test-anything', title: 'Landing pages', body: 'Headlines, copy and calls to action' },
        { href: '/#test-anything', title: 'Pricing pages', body: 'Plans, layout and wording' },
        { href: '/#test-anything', title: 'Split URL tests', body: 'Compare two whole pages' },
    ],
    Resources: [
        { href: '/docs', title: 'Documentation', body: 'Guides, SDK and API reference' },
        { href: '/docs/quick-start', title: 'Quick start', body: 'Your first experiment, step by step' },
        { href: '/demo.html', title: 'Demo page', body: 'The SDK running on a sample page' },
        { href: '/roadmap', title: 'Roadmap', body: 'Planned features by phase' },
        { href: '/pricing#faq', title: 'FAQ', body: 'Common questions' },
    ],
};

export const Arrow = () => <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M4 10h12M11 5l5 5-5 5" /></svg>;

export function SiteHeader() {
    return (
        <header className="relative z-40">
            <div className="mx-auto flex h-[88px] max-w-[1320px] items-center px-5 sm:px-8 lg:px-10">
                <Logo size="xl" />
                <nav className="ml-auto mr-auto hidden items-center gap-4 lg:flex" aria-label="Main">
                    <NavMenu label="Product" items={menus.Product} />
                    <NavMenu label="Use cases" items={menus['Use cases']} />
                    <Link href="/pricing" className="rounded-md px-3 py-2 text-[16px] text-zinc-700 hover:text-zinc-950">Pricing</Link>
                    <NavMenu label="Resources" items={menus.Resources} />
                </nav>
                <div className="ml-auto flex items-center gap-4 sm:gap-10 lg:ml-0">
                    <Link href="/signin" className="hidden text-[16px] text-zinc-700 hover:text-zinc-950 sm:block">Log in</Link>
                    <Link href="/signin" className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#0b1630] px-4 text-[15px] font-medium text-white shadow-sm hover:bg-[#13224a] sm:h-[54px] sm:px-6 sm:text-[16px]">Start for free <Arrow /></Link>
                </div>
            </div>
        </header>
    );
}

export function SiteFooter() {
    return (
        <footer className="border-t border-zinc-200/70 bg-white">
            <div className="mx-auto flex max-w-[1320px] flex-col gap-6 px-5 py-10 text-sm sm:px-8 md:flex-row md:items-center lg:px-10">
                <Logo />
                <nav className="flex flex-wrap gap-x-6 gap-y-2 text-zinc-600 md:ml-10" aria-label="Footer">
                    <Link href="/#how-it-works" className="hover:text-zinc-900">How it works</Link>
                    <Link href="/pricing" className="hover:text-zinc-900">Pricing</Link>
                    <Link href="/docs" className="hover:text-zinc-900">Docs</Link>
                    <Link href="/roadmap" className="hover:text-zinc-900">Roadmap</Link>
                    <Link href="/pricing#faq" className="hover:text-zinc-900">FAQ</Link>
                    <a href="/demo.html" className="hover:text-zinc-900">Demo page</a>
                    <Link href="/signin" className="hover:text-zinc-900">Sign in</Link>
                </nav>
                <p className="text-zinc-500 md:ml-auto">© {new Date().getFullYear()} freeabtest.com</p>
            </div>
        </footer>
    );
}
