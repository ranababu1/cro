'use client';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, type RefObject } from 'react';

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function focusableIn(root: HTMLElement): HTMLElement[] {
    return [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => !el.hasAttribute('hidden') && el.getAttribute('aria-hidden') !== 'true');
}

/** Keeps Tab and Shift+Tab inside `root`. Returns true when it moved focus. */
export function trapTab(e: KeyboardEvent, root: HTMLElement): boolean {
    if (e.key !== 'Tab') return false;
    const els = focusableIn(root);
    if (!els.length) { e.preventDefault(); return true; }
    const first = els[0], last = els[els.length - 1], active = document.activeElement;
    if (e.shiftKey && (active === first || !root.contains(active))) { e.preventDefault(); last.focus(); return true; }
    if (!e.shiftKey && (active === last || !root.contains(active))) { e.preventDefault(); first.focus(); return true; }
    return false;
}

/**
 * Modal menu behaviour: Escape and outside click close it, Tab is trapped inside, body scroll is locked,
 * focus moves in on open and back to the trigger on close, and a route change closes it.
 */
export function useOverlay(open: boolean, close: () => void, panel: RefObject<HTMLElement | null>, trigger?: RefObject<HTMLElement | null>) {
    const pathname = usePathname();
    const closeRef = useRef(close);
    useEffect(() => { closeRef.current = close; }, [close]);

    useEffect(() => { closeRef.current(); }, [pathname]);

    useEffect(() => {
        if (!open) return;
        const root = panel.current;
        const prevOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        (root && focusableIn(root)[0])?.focus();
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') { e.preventDefault(); closeRef.current(); return; }
            if (root) trapTab(e, root);
        };
        const onDown = (e: MouseEvent) => {
            const t = e.target as Node;
            // A backdrop closes on its own click, so the click never falls through to the page underneath.
            if ((t as Element).closest?.('[data-overlay-backdrop]')) return;
            if (root && !root.contains(t) && !trigger?.current?.contains(t)) closeRef.current();
        };
        document.addEventListener('keydown', onKey);
        document.addEventListener('mousedown', onDown);
        const trig = trigger?.current;
        return () => {
            document.body.style.overflow = prevOverflow;
            document.removeEventListener('keydown', onKey);
            document.removeEventListener('mousedown', onDown);
            trig?.focus();
        };
    }, [open, panel, trigger]);
}
