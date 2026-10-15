'use client';
import { useEffect, useRef } from 'react';

/** Thin bar at the top showing how far through the article the reader is. Decorative, hidden from assistive tech. */
export function ReadingProgress({ target }: { target: string }) {
    const bar = useRef<HTMLDivElement>(null);
    useEffect(() => {
        let frame = 0;
        const update = () => {
            frame = 0;
            const el = document.getElementById(target);
            if (!el || !bar.current) return;
            const r = el.getBoundingClientRect();
            const total = r.height - window.innerHeight;
            const pct = total <= 0 ? 1 : Math.min(1, Math.max(0, -r.top / total));
            bar.current.style.transform = `scaleX(${pct})`;
        };
        const onScroll = () => { if (!frame) frame = requestAnimationFrame(update); };
        update();
        window.addEventListener('scroll', onScroll, { passive: true });
        window.addEventListener('resize', onScroll);
        return () => { window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onScroll); cancelAnimationFrame(frame); };
    }, [target]);
    return (
        <div aria-hidden className="fixed inset-x-0 top-0 z-50 h-[3px] bg-transparent">
            <div ref={bar} className="h-full origin-left bg-gradient-to-r from-blue-600 to-teal-500" style={{ transform: 'scaleX(0)' }} />
        </div>
    );
}
