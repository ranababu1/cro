'use client';

/** Last resort when the root layout itself fails: plain HTML, no app styles or components. */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
    return (
        <html lang="en">
            <body style={{ fontFamily: 'system-ui, sans-serif', background: '#fafafa', color: '#18181b', margin: 0 }}>
                <main style={{ maxWidth: 420, margin: '15vh auto', padding: '0 16px', textAlign: 'center' }}>
                    <h1 style={{ fontSize: 22, fontWeight: 600 }}>Something went wrong</h1>
                    <p style={{ fontSize: 14, color: '#71717a' }}>freeabtest.com could not load this page. Please try again in a moment.</p>
                    {error.digest && <p style={{ fontSize: 12, color: '#a1a1aa', fontFamily: 'monospace' }}>Reference: {error.digest}</p>}
                    <button type="button" onClick={reset} style={{ marginTop: 16, padding: '8px 16px', borderRadius: 6, border: 0, background: '#2563eb', color: '#fff', fontWeight: 500, cursor: 'pointer' }}>Try again</button>
                </main>
            </body>
        </html>
    );
}
