'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { THEME_KEY, resolveTheme, type ThemeChoice } from '@/lib/theme';

const OPTIONS: { id: ThemeChoice; label: string }[] = [{ id: 'light', label: 'Light' }, { id: 'dark', label: 'Dark' }, { id: 'system', label: 'System' }];

function read(): ThemeChoice {
    try {
        const v = localStorage.getItem(THEME_KEY);
        return v === 'light' || v === 'dark' ? v : 'system';
    } catch { return 'system'; }
}

const listeners = new Set<() => void>();
function subscribe(l: () => void) {
    listeners.add(l);
    window.addEventListener('storage', l);
    return () => { listeners.delete(l); window.removeEventListener('storage', l); };
}

/** Light, dark or follow the system. Saved in this browser. */
export function ThemeToggle() {
    const choice = useSyncExternalStore(subscribe, read, () => 'system' as ThemeChoice);
    useEffect(() => {
        const mq = window.matchMedia('(prefers-color-scheme: dark)');
        const apply = () => document.documentElement.setAttribute('data-theme', resolveTheme(choice, mq.matches));
        apply();
        if (choice !== 'system') return;
        mq.addEventListener('change', apply);
        return () => mq.removeEventListener('change', apply);
    }, [choice]);
    const pick = (c: ThemeChoice) => {
        try { localStorage.setItem(THEME_KEY, c); } catch { /* private mode */ }
        listeners.forEach((l) => l());
    };
    return (
        <div role="group" aria-label="Theme" className="inline-flex rounded-md border border-zinc-200 p-0.5" data-testid="theme-toggle">
            {OPTIONS.map((o) => (
                <button key={o.id} type="button" aria-pressed={choice === o.id} onClick={() => pick(o.id)}
                    className={`rounded px-2 py-0.5 text-xs font-medium ${choice === o.id ? 'bg-zinc-100 text-zinc-900' : 'text-zinc-500 hover:text-zinc-900'}`}>
                    {o.label}
                </button>
            ))}
        </div>
    );
}
