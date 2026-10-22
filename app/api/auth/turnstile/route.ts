import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { clientIpFromHeaders } from '@/lib/telemetry';
import { issuePass, PASS_COOKIE, PASS_TTL_SECONDS, turnstileEnabled, verifyTurnstileToken } from '@/lib/turnstile';

const Body = z.object({ token: z.string().min(1).max(2048) });

/** Checks the Turnstile widget token on the server and sets the short-lived pass cookie. */
export async function POST(request: NextRequest) {
    if (!turnstileEnabled()) return NextResponse.json({ ok: true, skipped: true });
    const parsed = Body.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ ok: false, error: 'Missing bot check token' }, { status: 400 });
    const result = await verifyTurnstileToken(parsed.data.token, clientIpFromHeaders(request.headers));
    if (!result.ok) return NextResponse.json({ ok: false, error: 'Bot check failed. Please try again.' }, { status: 403 });
    const res = NextResponse.json({ ok: true });
    res.cookies.set(PASS_COOKIE, issuePass(), {
        httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/api/auth', maxAge: PASS_TTL_SECONDS,
    });
    return res;
}
