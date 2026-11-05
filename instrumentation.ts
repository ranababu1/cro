/**
 * Server start hook. Errors become operations alerts when OPS_ALERT_WEBHOOK_URL is set (lib/alerts.ts):
 * - onRequestError: errors Next.js sees while rendering pages or running routes;
 * - console.error: the routes catch most errors themselves and log them, so those logs are forwarded too.
 * Alerts are throttled per message, so an error storm sends one alert a minute per distinct error.
 */
export async function register() {
    if (process.env.NEXT_RUNTIME !== 'nodejs') return;
    const { alertWebhookUrl, installErrorForwarding } = await import('./lib/alerts');
    if (alertWebhookUrl()) installErrorForwarding();
}

export async function onRequestError(
    err: unknown,
    request: { path: string; method: string },
    context: { routerKind: string; routePath: string; routeType: string },
) {
    if (process.env.NEXT_RUNTIME !== 'nodejs') return;
    const { reportError } = await import('./lib/alerts');
    await reportError(err, { where: `${request.method} ${context.routePath}`, path: request.path.split('?')[0], type: context.routeType });
}
