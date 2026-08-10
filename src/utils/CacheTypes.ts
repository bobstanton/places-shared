export interface ICacheEntry {
  // Cache key
  k: string;
  // Timestamp when cached (Date.now())
  t: number;
  // Cached data (compressed or raw)
  d: unknown;
  // Entries explicitly cached forever are exempt from capacity eviction.
  retention?: 'forever';
}

export const CacheTTL = {
  MINUTES_15: 15 * 60 * 1000,
  HOUR_1: 60 * 60 * 1000,
  HOURS_2: 2 * 60 * 60 * 1000,
  HOURS_24: 24 * 60 * 60 * 1000,
  DAYS_7: 7 * 24 * 60 * 60 * 1000,
  NEVER: Infinity,
} as const;

export function isCacheExpired(cachedTimestamp: number, ttl: number): boolean {
  return (Date.now() - cachedTimestamp) >= ttl;
}

export function isHistoricalData(endDate: Date | null | undefined): boolean {
  if (!endDate) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return endDate < today;
}

export function getTTLForDateRange(baseTTL: number, endDate: Date | null | undefined): number {
  if (isHistoricalData(endDate)) {
    return CacheTTL.DAYS_7;
  }
  return baseTTL;
}

// Cache-key form: no space, and each caller states its own precision - the
// decimal count sets the sharing radius (4 decimals ≈ 11m buckets), and the
// right radius depends on what the cached data actually varies over.
export function formatCoordinate(lat: number, lon: number, precision: number): string {
  return `${lat.toFixed(precision)},${lon.toFixed(precision)}`;
}

export function formatCoordinates(coords: Array<{ latitude: number; longitude: number }>, precision: number): string {
  return coords.map(c => formatCoordinate(c.latitude, c.longitude, precision)).join(';');
}

export function buildCacheKey(...parts: (string | number | null | undefined)[]): string {
  return parts
    .filter(p => p !== null && p !== undefined && p !== '')
    .map(p => String(p))
    .join(':');
}

export type CacheMode = 'session' | 'persistent' | 'none';

export interface ICacheStorage {
  get(key: string): ICacheEntry | null;
  set(key: string, data: unknown): Promise<void>;
  getSize(): { count: number; sizeKB: number };
  clear(): Promise<void>;
  getMode(): CacheMode;
}

export class SessionCacheStorage implements ICacheStorage {
  private static readonly MAX_ENTRIES = 500;
  private cache = new Map<string, ICacheEntry>();

  get(key: string): ICacheEntry | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    this.cache.delete(key);
    this.cache.set(key, entry);
    return entry;
  }

  set(key: string, data: unknown): Promise<void> {
    this.cache.set(key, {
      k: key,
      t: Date.now(),
      d: data
    });
    if (this.cache.size > SessionCacheStorage.MAX_ENTRIES) {
      const oldest = this.cache.keys().next().value;
      if (oldest !== undefined) this.cache.delete(oldest);
    }
    return Promise.resolve();
  }

  getSize(): { count: number; sizeKB: number } {
    let sizeBytes = 0;
    for (const entry of this.cache.values()) {
      sizeBytes += JSON.stringify(entry).length;
    }
    return {
      count: this.cache.size,
      sizeKB: Math.round(sizeBytes / 1024 * 100) / 100
    };
  }

  clear(): Promise<void> {
    this.cache.clear();
    return Promise.resolve();
  }

  getMode(): 'session' {
    return 'session';
  }
}

export abstract class ServiceCachingDecoratorBase {
  constructor(protected readonly cacheStorage: ICacheStorage, protected readonly ttl: number = CacheTTL.NEVER) {}

  protected async executeWithCache<T>(cacheKey: string, fn: () => Promise<T>): Promise<T> {
    const cached = this.cacheStorage.get(cacheKey);
    if (cached !== null && !isCacheExpired(cached.t, this.ttl)) {
      return cached.d as T;
    }

    const result = await fn();
    await this.cacheStorage.set(cacheKey, result);
    return result;
  }

  getSize(): { count: number; sizeKB: number } {
    return this.cacheStorage.getSize();
  }

  async clear(): Promise<void> {
    return this.cacheStorage.clear();
  }
}
