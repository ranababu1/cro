'use client';

import { useState } from 'react';
import { cn } from './cn';

/** Monospace code panel with a copy button. Light by default; `tone="dark"` for marketing pages. */
export function CodeBlock({ code, label, tone = 'light', className }: { code: string; label?: string; tone?: 'light' | 'dark'; className?: string }) {
    const [copied, setCopied] = useState(false);
    const dark = tone === 'dark';
    return (
        <div className={cn('overflow-hidden rounded-lg border', dark ? 'border-zinc-800 bg-zinc-950' : 'border-zinc-200 bg-zinc-50', className)}>
            <div className={cn('flex items-center justify-between border-b px-4 py-2', dark ? 'border-zinc-800' : 'border-zinc-200')}>
                <span className={cn('text-xs font-medium', dark ? 'text-zinc-400' : 'text-zinc-500')}>{label ?? 'Code'}</span>
                <button
                    type="button"
                    onClick={async () => {
                        await navigator.clipboard.writeText(code);
                        setCopied(true);
                        setTimeout(() => setCopied(false), 1500);
                    }}
                    className={cn('rounded px-2 py-1 text-xs font-medium', dark ? 'text-zinc-300 hover:bg-zinc-800' : 'text-zinc-600 hover:bg-zinc-200/60')}
                >
                    {copied ? 'Copied' : 'Copy'}
                </button>
            </div>
            <pre tabIndex={0} className={cn('overflow-x-auto p-4 font-mono text-[13px] leading-6', dark ? 'text-zinc-200' : 'text-zinc-800')}>
                <code>{code}</code>
            </pre>
        </div>
    );
}
