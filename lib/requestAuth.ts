import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from './auth';
import { db, type SdkKeyContext } from './db';
import { apiKeyType, hashApiKey, isWellFormedApiKey } from './apiKeys';
import { sdkRateLimiter, type RateLimiter } from './rateLimit';

/** CORS headers for endpoints called from customer websites by the browser SDK. */
export const SDK_CORS_HEADERS: Record<string, string> = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-API-Key',
    'Access-Control-Max-Age': '86400',
};

export function sdkJson(body: unknown, status = 200, extra: Record<string, string> = {}): NextResponse {
    return NextResponse.json(body, { status, headers: { ...SDK_CORS_HEADERS, ...extra } });
}

function clientIp(request: NextRequest): string {
    return request.headers.get('x-forwarded-for')?.split(',')[0].trim() || request.headers.get('x-real-ip') || 'unknown';
}

function extractKey(request: NextRequest): string | null {
    return request.headers.get('x-api-key') || request.nextUrl.searchParams.get('key');
}

/**
 * Authenticates an SDK request by its API key and applies rate limiting per key and client IP.
 * Returns the key context, or a ready error response.
 */
export async function authenticateSdkRequest(
    request: NextRequest,
    limiter: RateLimiter = sdkRateLimiter,
): Promise<{ ctx: SdkKeyContext } | { error: NextResponse }> {
    const key = extractKey(request);
    if (!key || !isWellFormedApiKey(key)) {
        return { error: sdkJson({ error: 'Missing or invalid API key. Send it in the X-API-Key header.' }, 401) };
    }
    if (apiKeyType(key) !== 'sdk') {
        return { error: sdkJson({ error: 'Use an SDK key (cro_pk_...) here. Secret keys must never be used in browsers.' }, 401) };
    }
    const limit = limiter.check(`${hashApiKey(key).slice(0, 16)}:${clientIp(request)}`);
    if (!limit.allowed) {
        return { error: sdkJson({ error: 'Rate limit exceeded' }, 429, { 'Retry-After': String(limit.retryAfterSeconds) }) };
    }
    const ctx = await db.authenticateApiKey(key);
    if (!ctx) {
        return { error: sdkJson({ error: 'Unknown or revoked API key' }, 401) };
    }
    return { ctx };
}

export interface UserContext {
    userId: string | null;
    projectIds: string[];
    orgIds: string[];
    via: 'session' | 'secret_key';
}

/**
 * Authenticates dashboard and management API requests.
 * Accepts a signed-in session or an "Authorization: Bearer cro_sk_..." secret key.
 */
export async function getUserContext(request?: NextRequest): Promise<UserContext | null> {
    const authHeader = request?.headers.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
        const key = authHeader.slice('Bearer '.length).trim();
        if (apiKeyType(key) !== 'secret') return null;
        const ctx = await db.authenticateApiKey(key);
        if (!ctx) return null;
        return { userId: null, projectIds: [ctx.projectId], orgIds: [ctx.orgId], via: 'secret_key' };
    }
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;
    if (!userId) return null;
    const projects = await db.getProjectsForUser(userId);
    return {
        userId,
        projectIds: projects.map((p) => p.id),
        orgIds: [...new Set(projects.map((p) => p.org_id))],
        via: 'session',
    };
}

export function unauthorized(): NextResponse {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
