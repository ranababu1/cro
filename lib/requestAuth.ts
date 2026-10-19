import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from './auth';
import { db, type SdkKeyContext } from './db';
import { apiKeyType, hashApiKey, isWellFormedApiKey } from './apiKeys';
import { apiRateLimiter, sdkRateLimiter, type RateLimiter } from './rateLimit';
import { bumpMetric, METRICS, touchUserActivity } from './telemetry';

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
        void bumpMetric(METRICS.rate_limit_hits, {});
        return { error: sdkJson({ error: 'Rate limit exceeded' }, 429, { 'Retry-After': String(limit.retryAfterSeconds) }) };
    }
    const ctx = await db.authenticateApiKey(key);
    if (!ctx) {
        void bumpMetric(METRICS.errors, {});
        return { error: sdkJson({ error: 'Unknown or revoked API key' }, 401) };
    }
    if (ctx.orgStatus !== 'active') {
        return { error: sdkJson({ error: 'This account is suspended' }, 403) };
    }
    void bumpMetric(METRICS.api_key_requests, { orgId: ctx.orgId, projectId: ctx.projectId });
    return { ctx };
}

/**
 * Server SDK endpoints (/api/server/*): "Authorization: Bearer cro_sk_..." only. No Origin check, since
 * calls come from the customer's backend. Rate limited per key like the browser SDK endpoints.
 */
export async function authenticateServerRequest(
    request: NextRequest,
    limiter: RateLimiter = sdkRateLimiter,
): Promise<{ ctx: SdkKeyContext } | { error: NextResponse }> {
    const header = request.headers.get('authorization');
    const key = header?.startsWith('Bearer ') ? header.slice('Bearer '.length).trim() : '';
    if (!key || !isWellFormedApiKey(key) || apiKeyType(key) !== 'secret') {
        return { error: NextResponse.json({ error: 'Send a secret key (cro_sk_...) as "Authorization: Bearer <key>".' }, { status: 401 }) };
    }
    const limit = limiter.check(`srv:${hashApiKey(key).slice(0, 16)}`);
    if (!limit.allowed) {
        void bumpMetric(METRICS.rate_limit_hits, {});
        return { error: NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } }) };
    }
    const ctx = await db.authenticateApiKey(key);
    if (!ctx) return { error: NextResponse.json({ error: 'Unknown or revoked API key' }, { status: 401 }) };
    if (ctx.orgStatus !== 'active') return { error: NextResponse.json({ error: 'This account is suspended' }, { status: 403 }) };
    void bumpMetric(METRICS.api_key_requests, { orgId: ctx.orgId, projectId: ctx.projectId });
    return { ctx };
}

export interface UserContext {
    userId: string | null;
    projectIds: string[];
    orgIds: string[];
    via: 'session' | 'secret_key';
    /** True when every org the caller belongs to is suspended. */
    suspended: boolean;
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
        const active = ctx.orgStatus === 'active';
        return { userId: null, projectIds: active ? [ctx.projectId] : [], orgIds: active ? [ctx.orgId] : [], via: 'secret_key', suspended: !active };
    }
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;
    if (!userId) return null;
    const all = await db.getProjectsForUser(userId);
    // Projects in suspended orgs are invisible, so every scoped query excludes them.
    const projects = all.filter((p) => p.org_status === 'active');
    void touchUserActivity(userId, 'active');
    return {
        userId,
        projectIds: projects.map((p) => p.id),
        orgIds: [...new Set(projects.map((p) => p.org_id))],
        via: 'session',
        suspended: all.length > 0 && projects.length === 0,
    };
}

/**
 * Like getUserContext but returns a ready error: 401 when not signed in, 403 when the caller's tenant is suspended.
 */
export async function requireUserContext(request?: NextRequest, limiter: RateLimiter = apiRateLimiter): Promise<UserContext | NextResponse> {
    const authHeader = request?.headers.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
        const key = authHeader.slice('Bearer '.length).trim();
        if (apiKeyType(key) === 'secret') {
            const limit = limiter.check(`sk:${hashApiKey(key).slice(0, 16)}`);
            if (!limit.allowed) {
                void bumpMetric(METRICS.rate_limit_hits, {});
                return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } });
            }
        }
    }
    const ctx = await getUserContext(request);
    if (!ctx) return unauthorized();
    if (ctx.suspended) return NextResponse.json({ error: 'This account is suspended' }, { status: 403 });
    return ctx;
}

export function unauthorized(): NextResponse {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
