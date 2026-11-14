export interface ICacheEntry {
    k: string;
    t: number;
    d: unknown;
    retention?: 'forever';
}
export declare const CacheTTL: {
    readonly MINUTES_15: number;
    readonly HOUR_1: number;
    readonly HOURS_2: number;
    readonly HOURS_24: number;
    readonly DAYS_7: number;
    readonly NEVER: number;
};
export declare function isCacheExpired(cachedTimestamp: number, ttl: number): boolean;
export declare function isHistoricalData(endDate: Date | null | undefined): boolean;
export declare function getTTLForDateRange(baseTTL: number, endDate: Date | null | undefined): number;
export declare function formatCoordinate(lat: number, lon: number, precision: number): string;
export declare function formatCoordinates(coords: Array<{
    latitude: number;
    longitude: number;
}>, precision: number): string;
export declare function buildCacheKey(...parts: (string | number | null | undefined)[]): string;
export type CacheMode = 'session' | 'persistent' | 'none';
export interface ICacheStorage {
    get(key: string): ICacheEntry | null;
    set(key: string, data: unknown): Promise<void>;
    getSize(): {
        count: number;
        sizeKB: number;
    };
    clear(): Promise<void>;
    getMode(): CacheMode;
}
export declare class SessionCacheStorage implements ICacheStorage {
    private static readonly MAX_ENTRIES;
    private cache;
    get(key: string): ICacheEntry | null;
    set(key: string, data: unknown): Promise<void>;
    getSize(): {
        count: number;
        sizeKB: number;
    };
    clear(): Promise<void>;
    getMode(): 'session';
}
export declare abstract class ServiceCachingDecoratorBase {
    protected readonly cacheStorage: ICacheStorage;
    protected readonly ttl: number;
    private readonly onCacheHit?;
    constructor(cacheStorage: ICacheStorage, ttl?: number, onCacheHit?: (() => void) | undefined);
    protected executeWithCache<T>(cacheKey: string, fn: () => Promise<T>): Promise<T>;
    getSize(): {
        count: number;
        sizeKB: number;
    };
    clear(): Promise<void>;
}
