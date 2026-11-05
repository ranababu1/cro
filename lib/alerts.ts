/**
 * Operations alerts: server errors and new support tickets, posted to one webhook (Slack, Discord, or anything that
 * accepts JSON) when OPS_ALERT_WEBHOOK_URL is set. Never throws. Repeated messages are throttled per instance so an
 * error storm sends one alert a minute per distinct message, not thousands.
 *
 * The body carries `text` (Slack) and `content` (Discord) so both work without configuration.
 */
const THROTTLE_MS = 60_000;
const MAX_KEYS = 500;
const sent = new Map<string, number>();

export type AlertFetch = (url: string, init: { method: string; headers: Record<string, string>; body: string; signal?: AbortSignal }) => Promise<unknown>;

export function alertWebhookUrl(env: Record<string, string | undefined> = process.env): string | null {
    const raw = env.OPS_ALERT_WEBHOOK_URL?.trim();
    return raw && /^https:\/\//i.test(raw) ? raw : null;
}

/** Sends one alert. Returns true when it was sent, false when off, throttled or the post failed. */
export async function notifyOps(message: string, detail: Record<string, unknown> = {}, opts: { fetcher?: AlertFetch; now?: number; env?: Record<string, string | undefined> } = {}): Promise<boolean> {
    const url = alertWebhookUrl(opts.env);
    if (!url) return false;
    const now = opts.now ?? Date.now();
    const key = message.slice(0, 200);
    const last = sent.get(key);
    if (last !== undefined && now - last < THROTTLE_MS) return false;
    sent.set(key, now);
    if (sent.size > MAX_KEYS) for (const k of sent.keys()) { sent.delete(k); if (sent.size <= MAX_KEYS / 2) break; }
    const env = process.env.VERCEL_ENV || process.env.NODE_ENV || 'unknown';
    const lines = Object.entries(detail).map(([k, v]) => `${k}: ${typeof v === 'string' ? v : JSON.stringify(v)}`.slice(0, 500));
    const text = [`[freeabtest ${env}] ${message}`, ...lines].join('\n').slice(0, 1900);
    try {
        await (opts.fetcher ?? (fetch as unknown as AlertFetch))(url, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text, content: text }), signal: AbortSignal.timeout(3000),
        });
        return true;
    } catch {
        return false;
    }
}

/** First line of an error, without long ids, so repeats of one error share a throttle key. */
function errorTitle(err: unknown): string {
    const e = err as { name?: string; message?: string } | null;
    const msg = (e && typeof e === 'object' ? `${e.name ?? 'Error'}: ${e.message ?? ''}` : String(err)).split('\n')[0];
    return msg.replace(/\b[a-z]{2,4}_[A-Za-z0-9]{8,}\b/g, '<id>').slice(0, 200);
}

/** Reports a server error as an operations alert (when the webhook is set). Never throws. */
export async function reportError(err: unknown, detail: Record<string, unknown> = {}): Promise<boolean> {
    const e = err as { digest?: string; stack?: string } | null;
    const title = errorTitle(err);
    const digest = e && typeof e === 'object' ? e.digest : undefined;
    return notifyOps(`Server error: ${title}`, { ...detail, ...(digest ? { digest } : {}), stack: (e?.stack ?? '').split('\n').slice(1, 4).join(' | ') });
}

let forwarding = false;

/**
 * Forwards console.error calls that carry an Error (the routes log caught errors this way) to reportError.
 * Installed once at server start; the original console.error still runs.
 */
export function installErrorForwarding(): void {
    if (forwarding) return;
    forwarding = true;
    const original = console.error.bind(console);
    console.error = (...args: unknown[]) => {
        original(...args);
        const err = args.find((a) => a instanceof Error);
        if (!err) return;
        const context = typeof args[0] === 'string' ? args[0].slice(0, 200) : undefined;
        void reportError(err, context ? { context } : {});
    };
}

/** Test helper. */
export function resetAlertThrottle(): void {
    sent.clear();
}
