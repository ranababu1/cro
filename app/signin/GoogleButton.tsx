'use client';

import { signIn } from 'next-auth/react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '../components/ui';

type TurnstileApi = {
    render: (el: HTMLElement, opts: Record<string, unknown>) => string;
    reset: (id?: string) => void;
    remove: (id?: string) => void;
};
declare global {
    interface Window { turnstile?: TurnstileApi }
}

const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

function loadTurnstile(): Promise<TurnstileApi> {
    if (window.turnstile) return Promise.resolve(window.turnstile);
    return new Promise((resolve, reject) => {
        let s = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_SRC}"]`);
        if (!s) {
            s = document.createElement('script');
            s.src = SCRIPT_SRC;
            s.async = true;
            document.head.appendChild(s);
        }
        s.addEventListener('load', () => (window.turnstile ? resolve(window.turnstile) : reject(new Error('no turnstile'))));
        s.addEventListener('error', () => reject(new Error('turnstile failed to load')));
    });
}

/**
 * Google sign-in button. When a Turnstile site key is set, a bot check runs first; its token is checked
 * on the server (POST /api/auth/turnstile), which sets a short-lived pass the OAuth start requires.
 */
export default function GoogleButton({ callbackUrl, siteKey }: { callbackUrl: string; siteKey?: string | null }) {
    const [busy, setBusy] = useState(false);
    const [verified, setVerified] = useState(!siteKey);
    const [checkError, setCheckError] = useState<string | null>(null);
    const box = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!siteKey || !box.current) return;
        let id: string | undefined;
        let api: TurnstileApi | undefined;
        let cancelled = false;
        loadTurnstile().then((t) => {
            if (cancelled || !box.current) return;
            api = t;
            id = t.render(box.current, {
                sitekey: siteKey,
                action: 'signin',
                callback: async (token: string) => {
                    setCheckError(null);
                    const res = await fetch('/api/auth/turnstile', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }) }).catch(() => null);
                    if (res?.ok) setVerified(true);
                    else {
                        setVerified(false);
                        setCheckError('The bot check did not pass. Please try again.');
                        t.reset(id);
                    }
                },
                'expired-callback': () => setVerified(false),
                'error-callback': () => setCheckError('The bot check could not load. Refresh the page and try again.'),
            });
        }).catch(() => setCheckError('The bot check could not load. Check your connection or ad blocker, then refresh.'));
        return () => {
            cancelled = true;
            if (api && id) api.remove(id);
        };
    }, [siteKey]);

    return (
        <div>
            {siteKey && <div ref={box} className="mb-4 flex min-h-[65px] justify-center" data-testid="turnstile" />}
            {checkError && <p className="mb-3 text-sm text-red-600" role="alert">{checkError}</p>}
            <Button
                variant="secondary"
                size="lg"
                className="w-full"
                disabled={busy || !verified}
                onClick={() => {
                    setBusy(true);
                    void signIn('google', { callbackUrl });
                }}
            >
                <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
                    <path fill="#4285F4" d="M22.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h5.9a5 5 0 0 1-2.2 3.3v2.7h3.5c2.1-1.9 3.3-4.8 3.3-8.1z" />
                    <path fill="#34A853" d="M12 23c3 0 5.5-1 7.3-2.7l-3.5-2.7c-1 .7-2.3 1.1-3.8 1.1-2.9 0-5.4-2-6.3-4.6H2.1v2.8A11 11 0 0 0 12 23z" />
                    <path fill="#FBBC05" d="M5.7 14.1a6.6 6.6 0 0 1 0-4.2V7.1H2.1a11 11 0 0 0 0 9.8z" />
                    <path fill="#EA4335" d="M12 5.4c1.6 0 3.1.6 4.2 1.7l3.1-3.1A11 11 0 0 0 2.1 7.1l3.6 2.8C6.6 7.3 9.1 5.4 12 5.4z" />
                </svg>
                {busy ? 'Redirecting...' : 'Continue with Google'}
            </Button>
            {siteKey && !verified && !checkError && <p className="mt-2 text-center text-xs text-zinc-500">Complete the check above to continue.</p>}
        </div>
    );
}
