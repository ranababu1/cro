import { LEGAL } from '@/lib/legal';
import { publicAppOrigin } from '@/lib/publicOrigin';

/** RFC 9116 security contact. Expires is renewed on every request (one year ahead). */
export function GET() {
    const origin = publicAppOrigin();
    const expires = new Date(Date.now() + 365 * 86_400_000).toISOString().replace(/\.\d{3}Z$/, '.000Z');
    const body = [
        `Contact: mailto:${LEGAL.securityEmail}`,
        `Expires: ${expires}`,
        `Policy: ${origin}/security`,
        `Canonical: ${origin}/.well-known/security.txt`,
        'Preferred-Languages: en',
        '',
    ].join('\n');
    return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=86400' } });
}
