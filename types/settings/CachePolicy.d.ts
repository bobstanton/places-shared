export interface CachePolicy {
    readonly enabled: boolean;
    readonly maxAgeMs?: number;
    readonly expiresAt?: number;
}
export declare const CACHE_DEFAULT: CachePolicy;
export declare const CACHE_DISABLED: CachePolicy;
export declare const CACHE_FOREVER: CachePolicy;
export declare class CacheSettingError extends Error {
    constructor(rawValue: string);
}
export declare function parseCacheSetting(value: unknown, fallback?: CachePolicy): CachePolicy;
export declare function isCacheSettingValue(value: string): boolean;
export declare function isCacheEntryStale(policy: CachePolicy, cachedAt: number, defaultMaxAgeMs: number, now?: number): boolean;
export declare function cachePolicyExpiresAt(policy: CachePolicy, cachedAt: number, defaultMaxAgeMs: number): number | undefined;
export declare function cachePolicyRetention(policy: CachePolicy): 'forever' | undefined;
export declare function describeCachePolicy(policy: CachePolicy): string;
export interface CacheValueSuggestion {
    readonly value: string;
    readonly detail: string;
}
export declare const CACHE_VALUE_SUGGESTIONS: readonly CacheValueSuggestion[];
export declare const CACHE_PARAMETER_VALUES = "**true**, false, forever, 30m/2h/7d, 2027-01-01";
export declare const CACHE_PARAMETER_DESCRIPTION = "How long cached data stays fresh: true (block default), false (never cache), forever, a duration such as 30m/2h/7d, or an expiration date such as 2027-01-01";
