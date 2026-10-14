import Link from 'next/link';

/** Wordmark: a split square (control and variant) plus the product name. */
export function Logo({ href = '/' }: { href?: string }) {
    return (
        <Link href={href} className="inline-flex items-center gap-2 font-semibold tracking-tight text-zinc-900">
            <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden>
                <rect x="1" y="1" width="20" height="20" rx="5" fill="#4f46e5" />
                <rect x="5" y="6" width="5" height="10" rx="1.5" fill="#fff" />
                <rect x="12" y="6" width="5" height="10" rx="1.5" fill="#fff" fillOpacity="0.55" />
            </svg>
            <span>CRO</span>
        </Link>
    );
}
