export declare const DEFAULT_API_URL: string;

export interface FreeABTestOptions {
    /** Secret key (cro_sk_...). Keep it on the server. */
    secretKey: string;
    /** Defaults to https://www.freeabtest.com */
    apiUrl?: string;
    /** Custom fetch, for tests or older runtimes. */
    fetch?: typeof fetch;
    /** Request timeout. Default 5000 ms. */
    timeoutMs?: number;
    /** Config cache time. Defaults to the server's ttl_seconds (60 s). */
    configTtlMs?: number;
    /** Flush when this many events are queued (1 to 50). Default 20. */
    flushAt?: number;
    /** Flush queued events after this delay. Default 5000 ms; 0 waits for flushAt or flush(). */
    flushIntervalMs?: number;
    /** Called with errors from background flushes and config refreshes. */
    onError?: (error: unknown) => void;
}

export interface Decision {
    experimentId: string;
    variationId: string | null;
    variationName: string | null;
    variationUrl: string | null;
    /** True when the visitor is in the test. A rolled-out winner returns its variation with assigned false. */
    assigned: boolean;
    reason?: 'rollout' | 'quota_exceeded' | 'not_running' | string;
}

export interface ServerVariation { id: string; name: string; url: string | null; weight: number; is_control: boolean; paused: boolean }
export interface ServerGoal { id: string; name: string; type: 'click' | 'form' | 'page' | 'event'; selector: string; is_primary: boolean }
export interface ServerExperiment {
    id: string;
    name: string;
    status: string;
    traffic_allocation: number;
    rollout_variation_id: string | null;
    variations: ServerVariation[];
    goals: ServerGoal[];
}
export interface ServerConfig { experiments: ServerExperiment[]; ttl_seconds: number; generated_at: string }

export declare function hashUserToVariation(userId: string, experimentId: string): number;
export declare function pickVariation(userId: string, experiment: Pick<ServerExperiment, 'id' | 'traffic_allocation' | 'variations'>): ServerVariation | null;

export declare class FreeABTestError extends Error {
    status: number;
    body: unknown;
    constructor(message: string, status: number, body?: unknown);
}

export declare class FreeABTest {
    constructor(options: FreeABTestOptions);
    loadConfig(force?: boolean): Promise<ServerConfig>;
    getVariation(experimentId: string, userId: string, options?: { track?: boolean }): Promise<Decision>;
    decide(experimentId: string, userId: string, options?: { track?: boolean }): Promise<Decision>;
    trackExposure(experimentId: string, variationId: string, userId: string): void;
    trackConversion(experimentId: string, userId: string, options?: { variationId?: string; goalId?: string; eventName?: string; metadata?: Record<string, unknown> }): Promise<boolean>;
    flush(): Promise<void>;
    close(): Promise<void>;
}

export default FreeABTest;
