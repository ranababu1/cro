'use client';

import { useEffect, useState } from 'react';

/**
 * WordPress plugin card. Paid orgs get the download and one-click connect links (the link only prefills
 * the plugin form). Free orgs see that the plugin is for paid plans.
 */
export function WordPressCard() {
    const [allowed, setAllowed] = useState<boolean | null>(null);
    const [key, setKey] = useState<string | null>(null);
    const [hosts, setHosts] = useState<string[]>([]);
    useEffect(() => {
        fetch('/api/plan').then((r) => (r.ok ? r.json() : null)).then((p) => {
            const ok = !!p?.features?.wordpress_plugin;
            setAllowed(ok);
            if (!ok) return;
            fetch('/api/install').then((r) => (r.ok ? r.json() : null)).then((d) => setKey(d?.keys?.prod ?? null)).catch(() => undefined);
            fetch('/api/domains').then((r) => (r.ok ? r.json() : null)).then((d) => setHosts(((d?.domains ?? []) as { host: string }[]).map((x) => x.host).filter((h) => h !== 'localhost'))).catch(() => undefined);
        }).catch(() => setAllowed(false));
    }, []);
    if (allowed === null) return null;
    return (
        <div className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-sm" data-testid="wp-card">
            <p className="font-medium text-zinc-900">Using WordPress?</p>
            {allowed ? (
                <>
                    <p className="mt-1 text-zinc-600">Install the FreeABTest plugin instead of pasting the snippet. It works on your registered domains.</p>
                    <div className="mt-2 flex flex-wrap gap-3">
                        <a href="/api/downloads/wordpress" className="font-medium text-blue-700 hover:underline">Download WordPress plugin</a>
                        {key && hosts.map((h) => (
                            <a key={h} href={`https://${h}/wp-admin/options-general.php?page=freeabtest&freeabtest_prod=${encodeURIComponent(key)}`} target="_blank" rel="noopener noreferrer" className="font-medium text-blue-700 hover:underline">Connect WordPress on {h}</a>
                        ))}
                    </div>
                </>
            ) : (
                <p className="mt-1 text-zinc-600" data-testid="wp-card-upgrade">
                    The WordPress plugin is available to paid users only. You can still paste the snippet with any header code plugin.{' '}
                    <a href="/pricing" target="_blank" rel="noopener noreferrer" className="font-medium text-blue-700 hover:underline">See plans<span className="sr-only"> (opens in a new tab)</span></a>
                </p>
            )}
        </div>
    );
}
