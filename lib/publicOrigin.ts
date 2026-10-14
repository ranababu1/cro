/**
 * Origin used in customer-facing install snippets.
 * Override with NEXT_PUBLIC_APP_ORIGIN for local/staging; production default is the live site.
 */
export function publicAppOrigin(): string {
    const fromEnv = (process.env.NEXT_PUBLIC_APP_ORIGIN || '').trim().replace(/\/$/, '');
    if (fromEnv) return fromEnv;
    return 'https://www.freeabtest.com';
}

export function installSnippetHtml(origin: string, sdkKey: string): string {
    return `<script src="${origin}/sdk.js" data-key="${sdkKey}" async></script>`;
}
