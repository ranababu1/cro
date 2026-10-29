'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

/** What a page needs to know before showing an AI button. */
export type AiAvailability = { configured: boolean; allowed: boolean; ready: boolean; upgrade: string | null };

/** Loads the organization's AI status once. Null while loading or if it fails (AI buttons stay hidden). */
export function useAiAvailability(): AiAvailability | null {
    const [s, setS] = useState<AiAvailability | null>(null);
    useEffect(() => {
        let live = true;
        fetch('/api/ai').then((r) => (r.ok ? r.json() : null)).then((j) => { if (live && j) setS({ configured: j.configured, allowed: j.allowed, ready: j.ready, upgrade: j.upgrade }); }).catch(() => {});
        return () => { live = false; };
    }, []);
    return s;
}

/** POST to an AI route; returns the JSON or an error message. */
export async function postAi<T>(path: string, body: unknown): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
    try {
        const res = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) return { ok: false, error: String(data.error || 'The AI request failed. Try again.') };
        return { ok: true, data: data as T };
    } catch {
        return { ok: false, error: 'Could not reach the server. Try again.' };
    }
}

/** One line under an AI control when the organization cannot use it yet. Nothing when AI is not switched on for the site. */
export function AiHint({ ai }: { ai: AiAvailability | null }) {
    if (!ai || !ai.configured || ai.ready) return null;
    if (!ai.allowed) return <p className="text-xs text-zinc-500">AI suggestions come with Growth and Enterprise. <Link className="underline" href="/pricing" target="_blank" rel="noopener noreferrer">See plans</Link></p>;
    return <p className="text-xs text-zinc-500">Add your AI provider key in <Link className="underline" href="/settings/ai">Settings, AI</Link> to get suggestions here.</p>;
}
