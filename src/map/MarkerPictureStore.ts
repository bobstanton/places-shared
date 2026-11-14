import { getErrorMessage } from '../utils/Utilities';
import { logger } from '../utils/logger';

const DATABASE_NAME = 'places-marker-pictures';
const STORE_NAME = 'thumbnails';
const DATABASE_VERSION = 1;
const THUMBNAIL_TYPE = 'image/webp';
const THUMBNAIL_QUALITY = 0.82;
const MAX_PENDING_WRITES = 32;
const MAX_STORED_BYTES = 256 * 1024 * 1024;
const WRITES_BETWEEN_SWEEPS = 500;

interface StoredThumbnail {
  url: string;
  bytes: ArrayBuffer;
  type: string;
  storedAt: number;
  size: number;
}

let database: Promise<IDBDatabase | null> | undefined;
let pendingWrites = 0;
let writesSinceSweep = 0;

const storeCounts = { stored: 0, dropped: 0 };

export function takeStoredPictureCounts(): { stored: number; dropped: number } {
  const taken = { ...storeCounts };

  storeCounts.stored = 0;
  storeCounts.dropped = 0;

  return taken;
}

function openDatabase(): Promise<IDBDatabase | null> {
  if (database) return database;
  database = new Promise<IDBDatabase | null>(resolve => {
    const open = (version?: number): void => {
      try {
        if (typeof indexedDB === 'undefined') return resolve(null);
        const request = indexedDB.open(DATABASE_NAME, version);

        request.onupgradeneeded = () => {
          if (request.result.objectStoreNames.contains(STORE_NAME)) request.result.deleteObjectStore(STORE_NAME);
          request.result.createObjectStore(STORE_NAME, { keyPath: 'url' }).createIndex('storedAt', 'storedAt');
        };

        request.onsuccess = () => resolve(request.result);

        request.onerror = () => {
          if (version !== undefined && request.error?.name === 'VersionError') open();
          else resolve(null);
        };
      } catch {
        resolve(null);
      }
    };

    open(DATABASE_VERSION);
  });

  return database;
}

export function storeKey(url: string, decodePx: number): string {
  return `${decodePx}:${url.replace(/^[a-z][a-z0-9+.-]*:\/\/[^/]*/i, '')}`;
}

export async function readStoredPicture(url: string, decodePx: number): Promise<Blob | undefined> {
  const db = await openDatabase();

  if (!db) return undefined;

  return await new Promise<Blob | undefined>(resolve => {
    try {
      const request = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(storeKey(url, decodePx));

      request.onsuccess = () => {
        const stored = request.result as StoredThumbnail | undefined;

        resolve(stored ? new Blob([stored.bytes], { type: stored.type }) : undefined);
      };

      request.onerror = () => resolve(undefined);
    } catch {
      resolve(undefined);
    }
  });
}

export async function storePicture(url: string, picture: ImageBitmap | HTMLImageElement, decodePx: number): Promise<void> {
  if (typeof OffscreenCanvas !== 'function') return;

  if (pendingWrites >= MAX_PENDING_WRITES) {
    storeCounts.dropped++;

    return;
  }

  pendingWrites++;

  try {
    const width = picture.width;
    const height = picture.height;

    if (!width || !height) return;
    const canvas = new OffscreenCanvas(width, height);
    const context = canvas.getContext('2d');

    if (!context) return;
    context.drawImage(picture, 0, 0);
    const blob = await canvas.convertToBlob({ type: THUMBNAIL_TYPE, quality: THUMBNAIL_QUALITY });
    const bytes = await blob.arrayBuffer();
    const db = await openDatabase();

    if (!db) return;
    const entry: StoredThumbnail = { url: storeKey(url, decodePx), bytes, type: blob.type, storedAt: Date.now(), size: bytes.byteLength };

    db.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).put(entry);
    storeCounts.stored++;

    if (++writesSinceSweep >= WRITES_BETWEEN_SWEEPS) {
      writesSinceSweep = 0;

      await sweepOldest(db);
    }
  } catch (error) {
    logger.scope('MapSurface').debug('Marker thumbnail could not be stored', { url, error: getErrorMessage(error) });
  } finally {
    pendingWrites--;
  }
}

function storedPictureEntries(db: IDBDatabase): Promise<Array<{ url: string; size: number }>> {
  return new Promise(resolve => {
    try {
      const request = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).index('storedAt').openCursor();
      const found: Array<{ url: string; size: number }> = [];

      request.onsuccess = () => {
        const cursor = request.result;

        if (!cursor) return resolve(found);
        const entry = cursor.value as StoredThumbnail;

        found.push({ url: entry.url, size: entry.size ?? 0 });
        cursor.continue();
      };

      request.onerror = () => resolve([]);
    } catch {
      resolve([]);
    }
  });
}

export async function getStoredPictureStats(): Promise<{ count: number; sizeBytes: number }> {
  const db = await openDatabase();
  const entries = db ? await storedPictureEntries(db) : [];

  return { count: entries.length, sizeBytes: entries.reduce((sum, entry) => sum + entry.size, 0) };
}

async function sweepOldest(db: IDBDatabase): Promise<void> {
  const entries = await storedPictureEntries(db);

  let total = entries.reduce((sum, entry) => sum + entry.size, 0);

  if (total <= MAX_STORED_BYTES) return;

  const store = db.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME);
  let removed = 0;

  for (const entry of entries) {
    if (total <= MAX_STORED_BYTES) break;
    store.delete(entry.url);
    total -= entry.size;
    removed++;
  }

  logger.scope('MapSurface').debug('Marker thumbnails released', { removed, heldBytes: total });
}

export async function clearStoredPictures(): Promise<number> {
  const db = await openDatabase();

  if (!db) return 0;

  return await new Promise<number>(resolve => {
    try {
      const store = db.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME);
      const counted = store.count();

      counted.onsuccess = () => {
        const cleared = store.clear();

        cleared.onsuccess = () => resolve(counted.result);
        cleared.onerror = () => resolve(0);
      };

      counted.onerror = () => resolve(0);
    } catch {
      resolve(0);
    }
  });
}
