'use client';

import { useEffect, useState } from 'react';

/** Download link and one-click connect links for each registered domain. The link only prefills the plugin form. */
export function WordPressCard() {
    const [key, setKey] = useState<string | null>(null);
    const [hosts, setHosts] = useState<string[]>([]);
    useEffect(() => {
        fetch('/api/install').then((r) => (r.ok ? r.json() : null)).then((d) => setKey(d?.keys?.prod ?? null)).catch(() => undefined);
        fetch('/api/domains').then((r) => (r.ok ? r.json() : null)).then((d) => setHosts(((d?.domains ?? []) as { host: string }[]).map((x) => x.host).filter((h) => h !== 'localhost'))).catch(() => undefined);
    }, []);
    return (
        <div className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-sm" data-testid="wp-card">
            <p className="font-medium text-zinc-900">Using WordPress?</p>
            <p className="mt-1 text-zinc-600">Install the FreeABTest plugin instead of pasting the snippet.</p>
            <div className="mt-2 flex flex-wrap gap-3">
                <a href="/api/downloads/wordpress" className="font-medium text-blue-700 hover:underline">Download WordPress plugin</a>
                {key && hosts.map((h) => (
                    <a key={h} href={`https://${h}/wp-admin/options-general.php?page=freeabtest&freeabtest_prod=${encodeURIComponent(key)}`} target="_blank" rel="noopener noreferrer" className="font-medium text-blue-700 hover:underline">Connect WordPress on {h}</a>
                ))}
            </div>
        </div>
    );
}
