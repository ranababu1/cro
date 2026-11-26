'use client';

import { useEffect, useRef } from 'react';

/**
 * Viewport entrance for headings and a few feature blocks.
 * Content is visible by default (no JavaScript, reduced motion, or an element already in view).
 * Only off-screen elements are held back, then revealed when they enter the viewport.
 */
export function SiteReveal({ children, className = '', delay = 0, as: Tag = 'div' }: {
    children: React.ReactNode; className?: string; delay?: number; as?: 'div' | 'span';
}) {
    const ref = useRef<HTMLDivElement | null>(null);
    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            el.classList.add('is-visible');
            return;
        }
        document.documentElement.setAttribute('data-motion', 'on');
        const inView = () => {
            const r = el.getBoundingClientRect();
            return r.top < window.innerHeight * 0.92 && r.bottom > 0;
        };
        const show = () => { el.classList.remove('is-pending'); el.classList.add('is-visible'); };
        if (inView()) {
            el.classList.add('is-visible', 'is-immediate');
            return;
        }
        el.classList.add('is-pending');
        const io = new IntersectionObserver((entries) => {
            for (const e of entries) if (e.isIntersecting) { show(); io.disconnect(); }
        }, { threshold: 0.15, rootMargin: '0px 0px -8% 0px' });
        const start = () => io.observe(el);
        const wait = delay ? window.setTimeout(start, delay) : (start(), 0);
        const fallback = window.setTimeout(show, 1200);
        return () => { if (wait) window.clearTimeout(wait); window.clearTimeout(fallback); io.disconnect(); };
    }, [delay]);
    return <Tag ref={ref as never} className={`site-reveal ${className}`.trim()}>{children}</Tag>;
}
