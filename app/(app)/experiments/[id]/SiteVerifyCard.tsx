'use client';

import { useState } from 'react';
import { Alert, Button, ButtonLink } from '@/app/components/ui';
import { InstallSnippet } from '@/app/components/InstallSnippet';

export interface SiteState { required: boolean; verified: boolean; domain: string | null; lastSeenAt: string | null }

/** Free tests start only once our script has been seen live on the site. Shown until it has. */
export function SiteVerifyCard({ experimentId, site, onChange }: { experimentId: string; site: SiteState; onChange: (s: SiteState) => void }) {
    const [busy, setBusy] = useState(false);
    const [checked, setChecked] = useState(false);
    const [showSnippet, setShowSnippet] = useState(false);
    const recheck = async () => {
        setBusy(true);
        const res = await fetch(`/api/experiments/${experimentId}/site-check`).catch(() => null);
        setBusy(false);
        setChecked(true);
        if (res?.ok) onChange((await res.json()).site);
    };
    return (
        <Alert tone="warning" title="Install the snippet to verify your site" className="mb-4">
            <div data-testid="site-verify" className="space-y-3">
                <p>
                    Free tests start once our script has loaded on {site.domain ?? 'your site'}. Add the install snippet to the page you are testing,
                    open that page in your browser, then check again.
                    {site.lastSeenAt ? ` We last saw it on ${new Date(site.lastSeenAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}, which is too long ago.` : ''}
                </p>
                {checked && !busy && <p className="font-medium">Not seen yet. Make sure the page with the snippet has loaded, then try again.</p>}
                <div className="flex flex-wrap gap-2">
                    <Button size="sm" onClick={recheck} disabled={busy}>{busy ? 'Checking...' : 'Re-check'}</Button>
                    <Button size="sm" variant="secondary" onClick={() => setShowSnippet((v) => !v)}>{showSnippet ? 'Hide snippet' : 'Show snippet'}</Button>
                    <ButtonLink size="sm" variant="secondary" href="/settings/domains">Domains</ButtonLink>
                </div>
                {showSnippet && <InstallSnippet />}
            </div>
        </Alert>
    );
}
