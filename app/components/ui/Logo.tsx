import Link from 'next/link';

/** Green leaf mark plus the freeabtest.com wordmark. */
export function LeafMark({ className = 'h-6 w-6' }: { className?: string }) {
    return (
        <svg viewBox="0 0 32 32" className={className} aria-hidden>
            <defs>
                <linearGradient id="leaf-g" x1="4" y1="28" x2="28" y2="4" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#2563eb" />
                    <stop offset="1" stopColor="#14b8a6" />
                </linearGradient>
            </defs>
            <path d="M5 27C5 14 13 5 28 4c0 15-8 24-21 24-.7 0-1.4 0-2-.1z" fill="url(#leaf-g)" />
            <path d="M7 25C12 19 17 14 23 9" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" fill="none" opacity=".85" />
        </svg>
    );
}

export function Logo({ href = '/', size = 'md' }: { href?: string; size?: 'md' | 'lg' | 'xl' }) {
    return (
        <Link href={href} className="inline-flex items-center gap-2 font-semibold tracking-tight text-zinc-900">
            <LeafMark className={size === 'xl' ? 'h-8 w-8 sm:h-10 sm:w-10' : size === 'lg' ? 'h-7 w-7' : 'h-6 w-6'} />
            <span className={size === 'xl' ? 'text-[22px] sm:text-[28px]' : size === 'lg' ? 'text-xl' : 'text-[15px]'}>freeabtest<span className={size === 'xl' ? 'font-medium text-teal-600' : 'text-zinc-500'}>.com</span></span>
        </Link>
    );
}
