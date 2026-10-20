/** Calendar month helpers (UTC) for monthly plan allowances. Safe to import in client components. */
export function usageMonth(now = new Date()): string {
    return now.toISOString().slice(0, 7);
}

/** First day of next month, UTC, as ISO. */
export function monthResetAt(now = new Date()): string {
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString();
}

/** "1 November 2026" */
export function formatResetDate(iso: string): string {
    return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
}
