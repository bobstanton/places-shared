import { TileRequestQueue } from './TileRequestQueue';
import { sharedRegistryValue } from '../../utils/index';
import { logger as rootLogger } from '../../utils/index';
import { clamp } from '../../utils/index';

export interface TileCacheSettings {
  durationHours: number;
  maxSizeMB: number;
  enabledProviders: Record<string, boolean>;
}

export interface TileCacheFetchResult {
  arrayBuffer: ArrayBuffer;
  contentType?: string;
}

export interface TileCacheUsageEvent {
  provider: string;
  network: boolean;
  success: boolean;
  bytes: number;
}

export type TileCacheUsageSink = (event: TileCacheUsageEvent) => void;

interface TileCacheRecord {
  key: string;
  createdAt: number;
  lastAccessed: number;
  expiresAt: number;
  sizeBytes: number;
  contentType?: string;
  data: ArrayBuffer;
}

interface TileCacheMetadata {
  key: string;
  createdAt: number;
  lastAccessed: number;
  expiresAt: number;
  sizeBytes: number;
  contentType?: string;
}

interface MemoryCacheEntry {
  expiresAt: number;
  lastAccessed: number;
  sizeBytes: number;
  contentType?: string;
  data: ArrayBuffer;
}

interface TileRecordLookup {
  record: TileCacheRecord | null;
  openMs: number;
  queryMs: number;
  shared: boolean;
}

interface TileRecordLookupResult {
  record: TileCacheRecord | null;
  lookupMs: number;
  openMs?: number;
  queryMs?: number;
  shared?: boolean;
  timedOut: boolean;
}

const DB_NAME = 'places-tile-cache-v0';
const DB_VERSION = 2;
const STORE_NAME = 'tiles';
const METADATA_STORE_NAME = 'tileMetadata';
const CONFIG_STORAGE_KEY = 'places.tileCache.settings';
const DEFAULT_SETTINGS: TileCacheSettings = {
  durationHours: 0,
  maxSizeMB: 250,
  enabledProviders: {},
};

const MEMORY_CACHE_MAX_BYTES = 96 * 1024 * 1024;
const CACHE_HIT_TOUCH_INTERVAL_MS = 15 * 60 * 1000;
const CACHE_KNOWN_HIT_LOOKUP_TIMEOUT_MS = 5 * 1000;

const WRITE_QUEUE_FLUSH_DELAY_MS = 500;
const ENFORCE_MAX_SIZE_INTERVAL_MS = 30 * 1000;
const ENFORCE_MAX_SIZE_DEBOUNCE_MS = 10 * 1000;
const STARTUP_STATS_DELAY_MS = 30 * 1000;
const SLOW_TILE_MS = 250;
const SLOW_CACHE_PHASE_MS = 50;
const SUMMARY_INTERVAL_REQUESTS = 25;
const SUMMARY_INTERVAL_MS = 10 * 1000;
const MAX_RECORDS_PER_WRITE_TRANSACTION = 50;
const WRITE_QUEUE_HIGH_WATERMARK = 20;

const logger = rootLogger.scope('TileCache');

type TileCacheResultKind =
  | 'disabled'
  | 'memory-hit'
  | 'hit'
  | 'miss'
  | 'known-miss'
  | 'expired-miss'
  | 'stale-hit'
  | 'lookup-timeout-miss'
  | 'in-flight';

interface TileCacheState {
  dbPromise: Promise<IDBDatabase> | null;
  dbOpenMs: number | null;
  metadata: Map<string, TileCacheMetadata> | null;
  metadataLoadPromise: Promise<Map<string, TileCacheMetadata>> | null;
  memoryCache: Map<string, MemoryCacheEntry>;
  memoryCacheBytes: number;
  writeQueue: Map<string, TileCacheRecord>;
  writeTimer: number | null;
  writeInProgress: boolean;
  enforceTimer: number | null;
  enforcePromise: Promise<void> | null;
  pendingMaxBytes: number | null;
  lastEnforceAt: number;
  requests?: TileRequestQueue;
  inFlightReads: Map<string, Promise<TileRecordLookup>>;
  startupStatsTimer: number | null;
  lifecycleFlushRegistered: boolean;
  readonly pageHideHandler: () => void;
  readonly visibilityChangeHandler: () => void;
  stats: {
    disabled: number;
    memoryHit: number;
    hit: number;
    miss: number;
    knownMiss: number;
    expiredMiss: number;
    staleHit: number;
    lookupTimeoutMiss: number;
    inFlight: number;
    bytesRead: number;
    bytesFetched: number;
    lastSummaryAt: number;
  };
  usageSink: TileCacheUsageSink | null;
}

// Cross-bundle contract - see CrossBundleRegistry.
const TILE_CACHE_STATE_KEY = '__placesTileCacheState';

function createTileCacheState(): TileCacheState {
  return {
    dbPromise: null,
    dbOpenMs: null,
    metadata: null,
    metadataLoadPromise: null,
    memoryCache: new Map(),
    memoryCacheBytes: 0,
    writeQueue: new Map(),
    writeTimer: null,
    writeInProgress: false,
    enforceTimer: null,
    enforcePromise: null,
    pendingMaxBytes: null,
    lastEnforceAt: 0,
    inFlightReads: new Map(),
    startupStatsTimer: null,
    lifecycleFlushRegistered: false,
    pageHideHandler: () => {
      void TileCache.flushPendingWrites();
    },
    visibilityChangeHandler: () => {
      if (activeDocument.visibilityState === 'hidden') {
        void TileCache.flushPendingWrites();
      }
    },
    stats: {
      disabled: 0,
      memoryHit: 0,
      hit: 0,
      miss: 0,
      knownMiss: 0,
      expiredMiss: 0,
      staleHit: 0,
      lookupTimeoutMiss: 0,
      inFlight: 0,
      bytesRead: 0,
      bytesFetched: 0,
      lastSummaryAt: 0,
    },
    usageSink: null,
  };
}

const sharedState = sharedRegistryValue<TileCacheState>(TILE_CACHE_STATE_KEY, createTileCacheState);

export class TileCache {
  private static get state(): TileCacheState {
    return sharedState;
  }

  private static get requests(): TileRequestQueue {
    return this.state.requests ??= new TileRequestQueue();
  }

  static isNetworkDegraded(url: string): boolean { return this.requests.isDegraded(url); }

  static retryNetwork(url: string): void { this.requests.retryNow(url); }

  static onNetworkRecovery(listener: (host: string) => void): () => void { return this.requests.onRecovery(listener); }

  static configure(settings: Partial<TileCacheSettings>): void {
    const normalized = this.normalizeSettings({ ...this.getSettings(), ...settings });

    activeWindow.localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(normalized));

    if (normalized.durationHours > 0 && this.isIndexedDbAvailable()) {
      this.getMetadata().then(metadata => {
        logger.debug('tile cache metadata ready', {
          records: metadata.size,
          source: 'indexeddb-metadata',
        });
      }).catch((error: unknown) => {
        logger.debug('tile cache metadata load failed', { error });
      });
    }

    logger.debug('tile cache configured', {
      ...normalized,
      metadataRecords: this.state.metadata?.size,
      memoryMaxBytes: MEMORY_CACHE_MAX_BYTES,
    });

    if (this.state.startupStatsTimer !== null) {
      window.clearTimeout(this.state.startupStatsTimer);
    }

    if (normalized.durationHours > 0 && this.isIndexedDbAvailable()) {
      this.registerLifecycleFlush();
      this.state.startupStatsTimer = window.setTimeout(() => {
        this.state.startupStatsTimer = null;
        this.getStatsFromMetadata().then(stats => {
          logger.debug('tile cache startup stats', {
            records: stats.count,
            sizeBytes: stats.sizeBytes,
            source: 'indexeddb-metadata',
          });
        }).catch((error: unknown) => {
          logger.debug('tile cache startup stats failed', { error });
        });
      }, STARTUP_STATS_DELAY_MS);
    }
  }

  static getSettings(): TileCacheSettings {
    try {
      const raw = activeWindow.localStorage.getItem(CONFIG_STORAGE_KEY);

      if (!raw) return DEFAULT_SETTINGS;

      return this.normalizeSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(raw) as Partial<TileCacheSettings> });
    } catch {
      return DEFAULT_SETTINGS;
    }
  }

  static configureUsageSink(sink: TileCacheUsageSink | null): void {
    this.state.usageSink = sink;
  }

  static isEnabled(): boolean {
    return this.getSettings().durationHours > 0;
  }

  static isProviderEnabled(providerName?: string): boolean {
    if (!this.isEnabled()) return false;
    if (!providerName) return true;
    const normalizedProviderName = providerName.trim().toLowerCase();

    if (!normalizedProviderName) return true;

    return this.getSettings().enabledProviders[normalizedProviderName] !== false;
  }

  static async getOrFetch(url: string, fetcher: () => Promise<TileCacheFetchResult>, providerName?: string, signal?: AbortSignal): Promise<TileCacheFetchResult> {
    if (signal?.aborted) throw new DOMException('Map request canceled', 'AbortError');
    const totalStart = performance.now();
    const settings = this.getSettings();
    const ttl = settings.durationHours * 60 * 60 * 1000;

    if (!this.isProviderEnabled(providerName) || !this.isIndexedDbAvailable()) {
      const fetchStart = performance.now();

      if (window.navigator?.onLine === false) throw new Error('Map resource unavailable offline');
      const joined = this.requests.hasPending(`uncached:${url}`);
      const result = await this.requests.request(`uncached:${url}`, url, fetcher, signal);

      this.recordOperation(joined ? 'in-flight' : 'disabled', result.arrayBuffer.byteLength, providerName);
      this.logTiming('disabled', url, totalStart, {
        fetchMs: this.elapsed(fetchStart),
        bytes: result.arrayBuffer.byteLength,
      });

      return this.cloneResult(result);
    }

    const key = this.getCacheKey(url);
    const now = Date.now();
    const memoryEntry = this.getMemoryEntry(key, now);

    if (memoryEntry) {
      this.recordOperation('memory-hit', memoryEntry.sizeBytes, providerName);
      this.logTiming('memory-hit', url, totalStart, {
        bytes: memoryEntry.sizeBytes,
      });

      return {
        arrayBuffer: memoryEntry.data.slice(0),
        contentType: memoryEntry.contentType,
      };
    }

    const metadata = this.state.metadata;

    if (!metadata) {
      void this.getMetadata();
    }

    const metadataEntry = metadata?.get(key);

    if (!metadata) {
      const { record, lookupMs, openMs, queryMs, shared, timedOut } = await this.getRecordWithTimeout(key, CACHE_KNOWN_HIT_LOOKUP_TIMEOUT_MS);

      if (record && record.expiresAt > now) {
        this.promoteToMemory(key, record, now);
        this.touchMetadata(key, now);
        this.logTiming('hit', url, totalStart, {
          lookupMs,
          openMs,
          queryMs,
          shared,
          dbOpenMs: this.state.dbOpenMs ?? undefined,
          bytes: record.sizeBytes,
        });
        this.recordOperation('hit', record.sizeBytes, providerName);

        return {
          arrayBuffer: record.data.slice(0),
          contentType: record.contentType,
        };
      }

      if (timedOut) {
        logger.debug('tile cache direct lookup timed out, fetching as recovery', {
          tile: this.describeUrl(url),
          lookupMs: Math.round(lookupMs),
          timeoutMs: CACHE_KNOWN_HIT_LOOKUP_TIMEOUT_MS,
        });
      }

      return this.fetchAndQueueWrite({
        key,
        url,
        fetcher, signal,
        totalStart,
        now,
        ttl,
        resultKind: timedOut ? 'lookup-timeout-miss' : record ? 'expired-miss' : 'known-miss',
        settings,
        ...(providerName ? { providerName } : {}),
      });
    }

    if (!metadataEntry || metadataEntry.expiresAt <= now) {
      return this.fetchAndQueueWrite({
        key,
        url,
        fetcher, signal,
        totalStart,
        now,
        ttl,
        resultKind: metadataEntry ? 'expired-miss' : 'known-miss',
        settings,
        ...(providerName ? { providerName } : {}),
      });
    }

    const { record, lookupMs, openMs, queryMs, shared, timedOut } = await this.getRecordWithTimeout(key, CACHE_KNOWN_HIT_LOOKUP_TIMEOUT_MS);

    if (record && record.expiresAt > now) {
      this.promoteToMemory(key, record, now);
      this.touchMetadata(key, now);
      this.logTiming('hit', url, totalStart, {
        lookupMs,
        openMs,
        queryMs,
        shared,
        dbOpenMs: this.state.dbOpenMs ?? undefined,
        bytes: record.sizeBytes,
      });
      this.recordOperation('hit', record.sizeBytes, providerName);

      return {
        arrayBuffer: record.data.slice(0),
        contentType: record.contentType,
      };
    }

    if (timedOut) {
      logger.debug('tile cache known record lookup timed out, fetching as recovery', {
        tile: this.describeUrl(url),
        lookupMs: Math.round(lookupMs),
        timeoutMs: CACHE_KNOWN_HIT_LOOKUP_TIMEOUT_MS,
      });
    } else if (!record) {
      metadata.delete(key);
      this.deleteMetadata(key).catch((error: unknown) => {
        logger.debug('tile cache stale metadata delete failed', { tile: this.describeUrl(url), error });
      });
    }

    return this.fetchAndQueueWrite({
      key,
      url,
      fetcher, signal,
      totalStart,
      now,
      ttl,
      resultKind: timedOut ? 'lookup-timeout-miss' : 'miss',
      settings,
      ...(providerName ? { providerName } : {}),
    });
  }

  static async clear(): Promise<void> {
    if (!this.isIndexedDbAvailable()) return;
    this.clearTimers();
    this.state.pendingMaxBytes = null;
    this.state.writeQueue.clear();
    this.state.inFlightReads.clear();
    this.state.memoryCache.clear();
    this.state.memoryCacheBytes = 0;
    this.state.metadata = new Map();
    this.state.metadataLoadPromise = null;

    const db = await this.openDb();

    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME, METADATA_STORE_NAME], 'readwrite');

      transaction.objectStore(STORE_NAME).clear();
      transaction.objectStore(METADATA_STORE_NAME).clear();
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB transaction failed'));
    });
  }

  static async flushPendingWrites(): Promise<void> {
    if (this.state.writeTimer !== null) {
      window.clearTimeout(this.state.writeTimer);
      this.state.writeTimer = null;
    }

    await this.drainWriteQueue();
  }

  static async shutdown(): Promise<void> {
    this.clearTimers();
    await this.drainWriteQueue();

    if (this.state.lifecycleFlushRegistered) {
      activeWindow.removeEventListener('pagehide', this.state.pageHideHandler);
      activeDocument.removeEventListener('visibilitychange', this.state.visibilityChangeHandler);
      this.state.lifecycleFlushRegistered = false;
    }
  }

  static async getStats(): Promise<{ count: number; sizeBytes: number }> {
    return this.getStatsFromMetadata();
  }

  private static normalizeSettings(settings: Partial<TileCacheSettings>): TileCacheSettings {
    const rawDurationHours = Number.isFinite(settings.durationHours) ? settings.durationHours : DEFAULT_SETTINGS.durationHours;
    const durationHours = clamp(Math.floor(rawDurationHours ?? DEFAULT_SETTINGS.durationHours), 0, 999);
    const maxSizeMB = Number.isFinite(settings.maxSizeMB) ? Math.max(1, Math.floor(settings.maxSizeMB ?? DEFAULT_SETTINGS.maxSizeMB)) : DEFAULT_SETTINGS.maxSizeMB;
    const enabledProviders = this.normalizeEnabledProviders(settings.enabledProviders);

    return { durationHours, maxSizeMB, enabledProviders };
  }

  private static normalizeEnabledProviders(value: Record<string, boolean> | undefined): Record<string, boolean> {
    if (!value || typeof value !== 'object') return {};

    const normalized: Record<string, boolean> = {};

    for (const [providerName, enabled] of Object.entries(value)) {
      const key = providerName.trim().toLowerCase();

      if (!key || typeof enabled !== 'boolean') continue;
      normalized[key] = enabled;
    }

    return normalized;
  }

  private static isIndexedDbAvailable(): boolean {
    return typeof indexedDB !== 'undefined';
  }

  private static getCacheKey(url: string): string {
    return url;
  }

  private static async getMetadata(): Promise<Map<string, TileCacheMetadata>> {
    if (this.state.metadata) return this.state.metadata;
    if (this.state.metadataLoadPromise) return this.state.metadataLoadPromise;

    this.state.metadataLoadPromise = this.loadMetadataFromDb()
      .then(metadata => {
        this.state.metadata = metadata;

        return metadata;
      })
      .catch((error: unknown) => {
        logger.debug('tile cache metadata load failed', { error });
        this.state.metadata = new Map();

        return this.state.metadata;
      })
      .finally(() => {
        this.state.metadataLoadPromise = null;
      });

    return this.state.metadataLoadPromise;
  }

  private static async loadMetadataFromDb(): Promise<Map<string, TileCacheMetadata>> {
    const metadata = new Map<string, TileCacheMetadata>();
    const db = await this.openDb();

    await new Promise<void>((resolve, reject) => {
      const request = db.transaction(METADATA_STORE_NAME, 'readonly').objectStore(METADATA_STORE_NAME).openCursor();

      request.onsuccess = () => {
        const cursor = request.result;

        if (!cursor) {
          resolve();

          return;
        }

        const entry = cursor.value as TileCacheMetadata;

        if (this.isValidMetadata(entry)) {
          metadata.set(entry.key, entry);
        }

        cursor.continue();
      };

      request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'));
    });

    return metadata;
  }

  private static async getStatsFromMetadata(): Promise<{ count: number; sizeBytes: number }> {
    const metadata = await this.getMetadata();

    return {
      count: metadata.size,
      sizeBytes: Array.from(metadata.values()).reduce((sum, entry) => sum + entry.sizeBytes, 0),
    };
  }

  private static async openDb(): Promise<IDBDatabase> {
    if (this.state.dbPromise) return this.state.dbPromise;

    const requestedAt = performance.now();
    let upgraded = false;

    this.state.dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = event => {
        upgraded = true;
        const db = request.result;

        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'key' });

          store.createIndex('lastAccessed', 'lastAccessed');
          store.createIndex('expiresAt', 'expiresAt');
        }

        if (!db.objectStoreNames.contains(METADATA_STORE_NAME)) {
          const metadataStore = db.createObjectStore(METADATA_STORE_NAME, { keyPath: 'key' });

          metadataStore.createIndex('lastAccessed', 'lastAccessed');
          metadataStore.createIndex('expiresAt', 'expiresAt');
        }

        if (event.oldVersion < 2 && db.objectStoreNames.contains(STORE_NAME)) {
          const transaction = request.transaction;

          if (transaction) {
            const tileStore = transaction.objectStore(STORE_NAME);
            const metadataStore = transaction.objectStore(METADATA_STORE_NAME);
            const cursorRequest = tileStore.openCursor();

            cursorRequest.onsuccess = () => {
              const cursor = cursorRequest.result;

              if (!cursor) return;
              const record = cursor.value as TileCacheRecord;

              metadataStore.put(this.toMetadata(record));
              cursor.continue();
            };
          }
        }
      };

      request.onsuccess = () => {
        this.state.dbOpenMs = this.elapsed(requestedAt);
        logger.debug('tile cache db opened', { openMs: Math.round(this.state.dbOpenMs), upgraded });
        resolve(request.result);
      };

      request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'));
    });

    return this.state.dbPromise;
  }

  private static getRecord(key: string): Promise<TileRecordLookup> {
    const existing = this.state.inFlightReads.get(key);

    if (existing) return existing.then(lookup => ({ ...lookup, shared: true }));

    const lookup = this.readRecord(key);

    this.state.inFlightReads.set(key, lookup);

    void lookup.catch(() => undefined).finally(() => {
      if (this.state.inFlightReads.get(key) === lookup) this.state.inFlightReads.delete(key);
    });

    return lookup;
  }

  private static async readRecord(key: string): Promise<TileRecordLookup> {
    const openStart = performance.now();
    const db = await this.openDb();
    const openMs = this.elapsed(openStart);

    const queryStart = performance.now();
    const record = await new Promise<TileCacheRecord | null>((resolve, reject) => {
      const request = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(key);

      request.onsuccess = () => resolve((request.result as TileCacheRecord | undefined) ?? null);
      request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'));
    });

    return { record, openMs, queryMs: this.elapsed(queryStart), shared: false };
  }

  private static async getRecordWithTimeout(key: string, timeoutMs: number): Promise<TileRecordLookupResult> {
    const start = performance.now();
    const lookupPromise = this.getRecord(key);
    let timeoutId: number | null = null;

    const timeoutPromise = new Promise<'timeout'>(resolve => {
      timeoutId = window.setTimeout(() => resolve('timeout'), timeoutMs);
    });

    try {
      const result = await Promise.race([lookupPromise, timeoutPromise]);
      const lookupMs = this.elapsed(start);

      if (timeoutId !== null) window.clearTimeout(timeoutId);

      if (result === 'timeout') {
        lookupPromise.catch((error: unknown) => {
          logger.debug('late tile cache lookup failed', { error });
        });

        return { record: null, lookupMs, timedOut: true };
      }

      return { record: result.record, lookupMs, openMs: result.openMs, queryMs: result.queryMs, shared: result.shared, timedOut: false };
    } catch (error) {
      if (timeoutId !== null) window.clearTimeout(timeoutId);
      logger.debug('tile cache lookup failed', { error });

      return { record: null, lookupMs: this.elapsed(start), timedOut: false };
    }
  }

  private static async putRecords(records: TileCacheRecord[]): Promise<void> {
    if (records.length === 0) return;
    const db = await this.openDb();

    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME, METADATA_STORE_NAME], 'readwrite');
      const tileStore = transaction.objectStore(STORE_NAME);
      const metadataStore = transaction.objectStore(METADATA_STORE_NAME);

      for (const record of records) {
        tileStore.put(record);
        metadataStore.put(this.toMetadata(record));
      }

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB transaction failed'));
    });
  }

  private static async deleteRecord(key: string): Promise<void> {
    const db = await this.openDb();

    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME, METADATA_STORE_NAME], 'readwrite');

      transaction.objectStore(STORE_NAME).delete(key);
      transaction.objectStore(METADATA_STORE_NAME).delete(key);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB transaction failed'));
    });
  }

  private static async deleteMetadata(key: string): Promise<void> {
    const db = await this.openDb();

    await new Promise<void>((resolve, reject) => {
      const request = db.transaction(METADATA_STORE_NAME, 'readwrite').objectStore(METADATA_STORE_NAME).delete(key);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'));
    });
  }

  private static async touchRecordLastAccessed(key: string, lastAccessed: number): Promise<void> {
    const db = await this.openDb();

    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME, METADATA_STORE_NAME], 'readwrite');
      const tileStore = transaction.objectStore(STORE_NAME);
      const metadataStore = transaction.objectStore(METADATA_STORE_NAME);
      const request = tileStore.get(key);

      request.onsuccess = () => {
        const record = request.result as TileCacheRecord | undefined;

        if (!record) {
          this.state.metadata?.delete(key);
          metadataStore.delete(key);

          return;
        }

        record.lastAccessed = lastAccessed;
        tileStore.put(record);
        metadataStore.put(this.toMetadata(record));
      };

      request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'));
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB transaction failed'));
    });
  }

  private static toMetadata(record: TileCacheRecord): TileCacheMetadata {
    return {
      key: record.key,
      createdAt: record.createdAt,
      lastAccessed: record.lastAccessed,
      expiresAt: record.expiresAt,
      sizeBytes: record.sizeBytes,
      contentType: record.contentType,
    };
  }

  private static isValidMetadata(entry: Partial<TileCacheMetadata> | null | undefined): entry is TileCacheMetadata {
    return Boolean(entry?.key)
      && Number.isFinite(entry?.createdAt)
      && Number.isFinite(entry?.lastAccessed)
      && Number.isFinite(entry?.expiresAt)
      && Number.isFinite(entry?.sizeBytes);
  }

  private static getMemoryEntry(key: string, now: number): MemoryCacheEntry | null {
    const entry = this.state.memoryCache.get(key);

    if (!entry) return null;

    if (entry.expiresAt <= now) {
      this.state.memoryCache.delete(key);
      this.state.memoryCacheBytes -= entry.sizeBytes;

      return null;
    }

    entry.lastAccessed = now;
    this.state.memoryCache.delete(key);
    this.state.memoryCache.set(key, entry);

    return entry;
  }

  private static promoteToMemory(key: string, record: TileCacheRecord, now: number): void {
    this.setMemoryEntry(key, {
      expiresAt: record.expiresAt,
      lastAccessed: now,
      sizeBytes: record.sizeBytes,
      contentType: record.contentType,
      data: record.data,
    });
  }

  private static setMemoryEntry(key: string, entry: MemoryCacheEntry): void {
    const existing = this.state.memoryCache.get(key);

    if (existing) {
      this.state.memoryCacheBytes -= existing.sizeBytes;
      this.state.memoryCache.delete(key);
    }

    this.state.memoryCache.set(key, entry);
    this.state.memoryCacheBytes += entry.sizeBytes;
    this.evictMemoryCache();
  }

  private static evictMemoryCache(): void {
    while (this.state.memoryCacheBytes > MEMORY_CACHE_MAX_BYTES) {
      const oldest = this.state.memoryCache.keys().next().value;

      if (!oldest) return;
      const entry = this.state.memoryCache.get(oldest);

      this.state.memoryCache.delete(oldest);
      if (entry) this.state.memoryCacheBytes -= entry.sizeBytes;
    }
  }

  private static touchMetadata(key: string, now: number): void {
    const metadata = this.state.metadata;

    if (!metadata) return;
    const entry = metadata.get(key);

    if (!entry || now - entry.lastAccessed <= CACHE_HIT_TOUCH_INTERVAL_MS) return;
    entry.lastAccessed = now;
    this.touchRecordLastAccessed(key, now).catch((error: unknown) => {
      logger.debug('tile cache touch failed', { tile: this.describeUrl(key), error });
    });
  }

  private static async fetchAndQueueWrite(options: {
    key: string;
    url: string;
    fetcher: () => Promise<TileCacheFetchResult>;
    signal?: AbortSignal;
    totalStart: number;
    now: number;
    ttl: number;
    resultKind: TileCacheResultKind;
    settings: TileCacheSettings;
    providerName?: string;
  }): Promise<TileCacheFetchResult> {
    const staleResult = async (): Promise<TileCacheFetchResult | undefined> => {
      const { record } = await this.getRecordWithTimeout(options.key, CACHE_KNOWN_HIT_LOOKUP_TIMEOUT_MS);

      if (!record) return undefined;
      this.recordOperation('stale-hit', record.sizeBytes, options.providerName);
      this.logTiming('stale-hit', options.url, options.totalStart, { bytes: record.sizeBytes });

      return { arrayBuffer: record.data.slice(0), contentType: record.contentType };
    };

    if (options.signal?.aborted) throw new DOMException('Map request canceled', 'AbortError');

    if (window.navigator?.onLine === false || this.requests.isDegraded(options.url)) {
      const stale = await staleResult();

      if (stale) {
        if (window.navigator?.onLine !== false) {
          void this.requests.request(options.key, options.url, options.fetcher, options.signal,
            result => this.afterNetworkFetch({ ...options, result, now: Date.now() })).catch(() => undefined);
        }

        return stale;
      }
    }

    const fetchStart = performance.now();
    let result: TileCacheFetchResult;
    const joined = this.requests.hasPending(options.key);

    try {
      result = await this.requests.request(options.key, options.url, options.fetcher, options.signal, result => {
        this.afterNetworkFetch({ ...options, result, now: Date.now() });
      });
    } catch (error) {
      if (options.signal?.aborted) throw error;
      const stale = await staleResult();

      if (stale) return stale;

      throw error;
    }

    this.logTiming(options.resultKind, options.url, options.totalStart, {
      fetchMs: this.elapsed(fetchStart), bytes: result.arrayBuffer.byteLength,
    });
    this.recordOperation(joined ? 'in-flight' : options.resultKind, result.arrayBuffer.byteLength, options.providerName);

    return this.cloneResult(result);
  }

  private static afterNetworkFetch(options: {
    key: string;
    result: TileCacheFetchResult;
    now: number;
    ttl: number;
    settings: TileCacheSettings;
  }): void {
    const record: TileCacheRecord = {
      key: options.key,
      createdAt: options.now,
      lastAccessed: options.now,
      expiresAt: options.now + options.ttl,
      sizeBytes: options.result.arrayBuffer.byteLength,
      contentType: options.result.contentType,
      data: options.result.arrayBuffer,
    };

    this.setMemoryEntry(options.key, {
      expiresAt: record.expiresAt,
      lastAccessed: record.lastAccessed,
      sizeBytes: record.sizeBytes,
      contentType: record.contentType,
      data: record.data,
    });

    this.queueWrite(record, options.settings.maxSizeMB * 1024 * 1024);
  }

  private static queueWrite(record: TileCacheRecord, maxBytes: number): void {
    this.state.writeQueue.set(record.key, record);
    this.state.pendingMaxBytes = maxBytes;

    if (this.state.writeQueue.size >= WRITE_QUEUE_HIGH_WATERMARK) {
      if (this.state.writeTimer !== null) {
        window.clearTimeout(this.state.writeTimer);
        this.state.writeTimer = null;
      }

      if (this.state.writeInProgress) {
        this.scheduleWriteFlush();

        return;
      }

      void this.drainWriteQueue();

      return;
    }

    this.scheduleWriteFlush();
  }

  private static scheduleWriteFlush(): void {
    if (this.state.writeTimer !== null) return;

    this.state.writeTimer = window.setTimeout(() => {
      this.state.writeTimer = null;
      void this.drainWriteQueue();
    }, WRITE_QUEUE_FLUSH_DELAY_MS);
  }

  private static async drainWriteQueue(): Promise<void> {
    if (this.state.writeInProgress) {
      this.scheduleWriteFlush();

      return;
    }

    this.state.writeInProgress = true;

    try {
      while (this.state.writeQueue.size > 0) {
        const records: TileCacheRecord[] = [];

        while (this.state.writeQueue.size > 0 && records.length < MAX_RECORDS_PER_WRITE_TRANSACTION) {
          const [key, record] = this.state.writeQueue.entries().next().value as [string, TileCacheRecord];

          this.state.writeQueue.delete(key);
          records.push(record);
        }

        const writeStart = performance.now();

        try {
          await this.putRecords(records);
          const metadata = this.state.metadata;

          if (metadata) {
            for (const record of records) {
              metadata.set(record.key, this.toMetadata(record));
            }
          }

          const writeMs = this.elapsed(writeStart);

          if (writeMs >= SLOW_CACHE_PHASE_MS) {
            const bytes = records.reduce((sum, record) => sum + record.sizeBytes, 0);

            logger.debug('tile cache write batch timing', {
              writeMs: Math.round(writeMs),
              records: records.length,
              bytes,
            });
          }
        } catch (error) {
          logger.debug('tile cache write batch failed', { records: records.length, error });
        }
      }
    } finally {
      this.state.writeInProgress = false;

      if (this.state.writeQueue.size > 0) {
        this.scheduleWriteFlush();
      }

      if (this.state.pendingMaxBytes !== null) {
        this.scheduleEnforceMaxSize(this.state.pendingMaxBytes);
      }
    }
  }

  private static scheduleEnforceMaxSize(maxBytes: number): void {
    this.state.pendingMaxBytes = maxBytes;

    if (this.state.enforceTimer !== null) {
      window.clearTimeout(this.state.enforceTimer);
    }

    this.state.enforceTimer = window.setTimeout(() => {
      this.state.enforceTimer = null;
      this.runScheduledEnforceMaxSize();
    }, ENFORCE_MAX_SIZE_DEBOUNCE_MS);
  }

  private static runScheduledEnforceMaxSize(): void {
    const maxBytes = this.state.pendingMaxBytes;

    if (maxBytes === null) return;

    if (this.state.enforcePromise) {
      this.scheduleEnforceMaxSize(maxBytes);

      return;
    }

    const now = Date.now();
    const elapsedSinceLastEnforce = now - this.state.lastEnforceAt;

    if (elapsedSinceLastEnforce < ENFORCE_MAX_SIZE_INTERVAL_MS) {
      this.state.enforceTimer = window.setTimeout(() => {
        this.state.enforceTimer = null;
        this.runScheduledEnforceMaxSize();
      }, ENFORCE_MAX_SIZE_INTERVAL_MS - elapsedSinceLastEnforce);

      return;
    }

    this.state.pendingMaxBytes = null;
    this.state.lastEnforceAt = now;
    this.state.enforcePromise = this.enforceMaxSizeFromMetadata(maxBytes)
      .catch((error: unknown) => {
        logger.debug('tile cache size enforcement failed', { error });
      })
      .finally(() => {
        this.state.enforcePromise = null;
      });
  }

  private static async enforceMaxSizeFromMetadata(maxBytes: number): Promise<void> {
    const start = performance.now();
    const metadata = await this.getMetadata();
    let sizeBytes = Array.from(metadata.values()).reduce((sum, entry) => sum + entry.sizeBytes, 0);

    if (sizeBytes <= maxBytes) return;

    const oldestFirst = Array.from(metadata.values()).sort((a, b) => a.lastAccessed - b.lastAccessed);
    let deleted = 0;

    for (const entry of oldestFirst) {
      metadata.delete(entry.key);
      this.removeMemoryEntry(entry.key);
      this.deleteRecord(entry.key).catch((error: unknown) => {
        logger.debug('tile cache delete failed during size enforcement', { error });
      });
      deleted += 1;
      sizeBytes -= entry.sizeBytes;
      if (sizeBytes <= maxBytes) break;
    }

    logger.debug('tile cache size enforcement timing', {
      elapsedMs: Math.round(this.elapsed(start)),
      maxBytes,
      deleted,
      remainingBytes: sizeBytes,
      source: 'indexeddb-metadata',
    });
  }

  private static removeMemoryEntry(key: string): void {
    const entry = this.state.memoryCache.get(key);

    if (!entry) return;
    this.state.memoryCache.delete(key);
    this.state.memoryCacheBytes -= entry.sizeBytes;
  }

  private static clearTimers(): void {
    if (this.state.writeTimer !== null) window.clearTimeout(this.state.writeTimer);
    if (this.state.enforceTimer !== null) window.clearTimeout(this.state.enforceTimer);
    if (this.state.startupStatsTimer !== null) window.clearTimeout(this.state.startupStatsTimer);
    this.state.writeTimer = null;
    this.state.enforceTimer = null;
    this.state.startupStatsTimer = null;
  }

  private static registerLifecycleFlush(): void {
    if (this.state.lifecycleFlushRegistered) return;
    this.state.lifecycleFlushRegistered = true;

    activeWindow.addEventListener('pagehide', this.state.pageHideHandler);
    activeDocument.addEventListener('visibilitychange', this.state.visibilityChangeHandler);
  }

  private static elapsed(start: number): number {
    return performance.now() - start;
  }

  private static logTiming(result: TileCacheResultKind, url: string, totalStart: number, details: Record<string, number | string | boolean | undefined>): void {
    const totalMs = this.elapsed(totalStart);

    if (totalMs < SLOW_TILE_MS && (result === 'hit' || result === 'memory-hit')) {
      return;
    }

    logger.debug('tile load timing', {
      result,
      tile: this.describeUrl(url),
      totalMs: Math.round(totalMs),
      ...this.roundTimingDetails(details),
    });
  }

  private static roundTimingDetails(details: Record<string, number | string | boolean | undefined>): Record<string, number | string | boolean | undefined> {
    return Object.fromEntries(Object.entries(details).map(([key, value]) => [
      key,
      typeof value === 'number' && key.endsWith('Ms') ? Math.round(value) : value,
    ]));
  }

  private static describeUrl(url: string): string {
    try {
      const parsed = new URL(url);

      return `${parsed.origin}${parsed.pathname}`;
    } catch {
      return url.split('?')[0] || url;
    }
  }

  private static cloneResult(result: TileCacheFetchResult): TileCacheFetchResult {
    return {
      arrayBuffer: result.arrayBuffer.slice(0),
      contentType: result.contentType,
    };
  }

  private static recordOperation(result: TileCacheResultKind, bytes: number, providerName?: string): void {
    this.reportUsage(result, bytes, providerName);

    switch (result) {
      case 'disabled':
        this.state.stats.disabled += 1;
        this.state.stats.bytesFetched += bytes;
        break;
      case 'memory-hit':
        this.state.stats.memoryHit += 1;
        this.state.stats.bytesRead += bytes;
        break;
      case 'hit':
        this.state.stats.hit += 1;
        this.state.stats.bytesRead += bytes;
        break;
      case 'miss':
        this.state.stats.miss += 1;
        this.state.stats.bytesFetched += bytes;
        break;
      case 'known-miss':
        this.state.stats.knownMiss += 1;
        this.state.stats.bytesFetched += bytes;
        break;
      case 'expired-miss':
        this.state.stats.expiredMiss += 1;
        this.state.stats.bytesFetched += bytes;
        break;
      case 'stale-hit':
        this.state.stats.staleHit += 1;
        this.state.stats.bytesRead += bytes;
        break;
      case 'lookup-timeout-miss':
        this.state.stats.lookupTimeoutMiss += 1;
        this.state.stats.bytesFetched += bytes;
        break;
      case 'in-flight':
        this.state.stats.inFlight += 1;
        this.state.stats.bytesRead += bytes;
        break;
    }

    this.maybeLogSummary();
  }

  private static reportUsage(result: TileCacheResultKind, bytes: number, providerName?: string): void {
    const sink = this.state.usageSink;

    if (!sink || !providerName) return;

    const network = result !== 'memory-hit' && result !== 'hit' && result !== 'in-flight' && result !== 'stale-hit';

    sink({ provider: providerName, network, success: result !== 'stale-hit', bytes });
  }

  private static maybeLogSummary(): void {
    const total = this.state.stats.disabled
      + this.state.stats.memoryHit
      + this.state.stats.hit
      + this.state.stats.miss
      + this.state.stats.knownMiss
      + this.state.stats.expiredMiss
      + this.state.stats.staleHit
      + this.state.stats.lookupTimeoutMiss
      + this.state.stats.inFlight;
    const now = Date.now();
    const shouldLog = total > 0
      && (total % SUMMARY_INTERVAL_REQUESTS === 0 || now - this.state.stats.lastSummaryAt >= SUMMARY_INTERVAL_MS);

    if (!shouldLog) return;

    this.state.stats.lastSummaryAt = now;
    const cacheable = this.state.stats.memoryHit
      + this.state.stats.hit
      + this.state.stats.miss
      + this.state.stats.knownMiss
      + this.state.stats.expiredMiss
      + this.state.stats.staleHit
      + this.state.stats.lookupTimeoutMiss
      + this.state.stats.inFlight;
    const cacheServed = this.state.stats.memoryHit + this.state.stats.hit + this.state.stats.staleHit + this.state.stats.inFlight;

    if (this.state.writeQueue.size > 0 && !this.state.writeInProgress && this.state.writeTimer === null) {
      this.scheduleWriteFlush();
    }

    logger.debug('tile cache session summary', {
      total,
      memoryHit: this.state.stats.memoryHit,
      hit: this.state.stats.hit,
      miss: this.state.stats.miss,
      knownMiss: this.state.stats.knownMiss,
      expiredMiss: this.state.stats.expiredMiss,
      staleHit: this.state.stats.staleHit,
      lookupTimeoutMiss: this.state.stats.lookupTimeoutMiss,
      inFlight: this.state.stats.inFlight,
      disabled: this.state.stats.disabled,
      hitRate: cacheable > 0 ? Math.round((cacheServed / cacheable) * 100) : 0,
      bytesRead: this.state.stats.bytesRead,
      bytesFetched: this.state.stats.bytesFetched,
      inFlightFetches: this.requests.pendingCount,
      memoryEntries: this.state.memoryCache.size,
      memoryBytes: this.state.memoryCacheBytes,
      metadataRecords: this.state.metadata?.size ?? 0,
      pendingWrites: this.state.writeQueue.size,
    });
  }
}
