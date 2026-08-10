export interface TileCacheSettings {
    durationHours: number;
    maxSizeMB: number;
    enabledProviders: Record<string, boolean>;
}
export interface TileCacheFetchResult {
    arrayBuffer: ArrayBuffer;
    contentType?: string;
}
export declare class TileCache {
    private static get state();
    static configure(settings: Partial<TileCacheSettings>): void;
    static getSettings(): TileCacheSettings;
    static isEnabled(): boolean;
    static isProviderEnabled(providerName?: string): boolean;
    static getOrFetch(url: string, fetcher: () => Promise<TileCacheFetchResult>): Promise<TileCacheFetchResult>;
    static clear(): Promise<void>;
    static flushPendingWrites(): Promise<void>;
    static shutdown(): Promise<void>;
    static getStats(): Promise<{
        count: number;
        sizeBytes: number;
    }>;
    private static normalizeSettings;
    private static normalizeEnabledProviders;
    private static isIndexedDbAvailable;
    private static getCacheKey;
    private static getMetadata;
    private static loadMetadataFromDb;
    private static getStatsFromMetadata;
    private static openDb;
    private static getRecord;
    private static readRecord;
    private static getRecordWithTimeout;
    private static putRecords;
    private static deleteRecord;
    private static deleteMetadata;
    private static touchRecordLastAccessed;
    private static toMetadata;
    private static isValidMetadata;
    private static getMemoryEntry;
    private static promoteToMemory;
    private static setMemoryEntry;
    private static evictMemoryCache;
    private static touchMetadata;
    private static fetchAndQueueWrite;
    private static afterNetworkFetch;
    private static queueWrite;
    private static scheduleWriteFlush;
    private static drainWriteQueue;
    private static scheduleEnforceMaxSize;
    private static runScheduledEnforceMaxSize;
    private static enforceMaxSizeFromMetadata;
    private static removeMemoryEntry;
    private static clearTimers;
    private static registerLifecycleFlush;
    private static elapsed;
    private static logTiming;
    private static roundTimingDetails;
    private static describeUrl;
    private static cloneResult;
    private static recordOperation;
    private static maybeLogSummary;
}
