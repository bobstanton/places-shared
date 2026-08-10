export declare class ProviderRateLimitTracker {
    private buckets;
    private queues;
    runExclusive<T>(bucket: string, work: () => Promise<T>): Promise<T>;
    waitForCapacity(bucket: string): Promise<void>;
    recordResponse(bucket: string, status: number, headers: Record<string, string>): boolean;
}
export declare function executeRateLimited<T extends {
    status: number;
    headers: Record<string, string>;
}>(tracker: ProviderRateLimitTracker, bucket: string, execute: () => Promise<T>): Promise<T>;
export declare class FixedIntervalRateLimiter {
    private readonly minIntervalMs;
    private lastRequestTime;
    constructor(minIntervalMs: number);
    wait(): Promise<void>;
}
