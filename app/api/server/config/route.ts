import { NextRequest, NextResponse } from 'next/server';
import { authenticateServerRequest } from '@/lib/requestAuth';
import { bumpMetric, METRICS } from '@/lib/telemetry';
import { serverConfig } from '@/lib/sdkFlows';

/** Server SDK: running and rolled-out experiments of the key's project, for local hashing. */
export async function GET(request: NextRequest) {
    try {
        const auth = await authenticateServerRequest(request);
        if ('error' in auth) return auth.error;
        return NextResponse.json(await serverConfig(auth.ctx), { headers: { 'Cache-Control': 'no-store' } });
    } catch (error) {
        console.error('Failed to load server config:', error);
        void bumpMetric(METRICS.errors, {});
        return NextResponse.json({ error: 'Failed to load config' }, { status: 500 });
    }
}
