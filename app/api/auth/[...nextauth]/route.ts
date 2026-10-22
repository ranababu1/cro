import NextAuth from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { runWithAuthRequest } from "@/lib/authRequest";
import { clientIpFromHeaders } from "@/lib/telemetry";
import { BOT_CHECK_ERROR, botCheckPassed, PASS_COOKIE } from "@/lib/turnstile";

const handler = NextAuth(authOptions);

type Ctx = { params: Promise<{ nextauth: string[] }> };

function info(request: NextRequest) {
    return { ip: clientIpFromHeaders(request.headers), cookies: Object.fromEntries(request.cookies.getAll().map((c) => [c.name, c.value])) };
}

export async function GET(request: NextRequest, ctx: Ctx) {
    return runWithAuthRequest(info(request), () => handler(request, ctx));
}

/** The OAuth start (POST /api/auth/signin/google) needs a bot-check pass when Turnstile is on. */
export async function POST(request: NextRequest, ctx: Ctx) {
    const { nextauth } = await ctx.params;
    if (nextauth[0] === 'signin' && nextauth[1] && !botCheckPassed(request.cookies.get(PASS_COOKIE)?.value)) {
        const url = `/signin?error=${BOT_CHECK_ERROR}`;
        const form = await request.clone().formData().catch(() => null);
        // next-auth/react posts json=true and follows the returned url; a plain form post gets a redirect.
        if (form?.get('json') === 'true') return NextResponse.json({ url }, { status: 200 });
        return NextResponse.redirect(new URL(url, request.url), 303);
    }
    return runWithAuthRequest(info(request), () => handler(request, ctx));
}
