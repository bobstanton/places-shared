import type { IconImageQuality } from './IconImageQuality';
import type { ComputedIconStyle, IconShapeStyle } from '../Place';
import { getMaxIconScale, MARKER_ICON_SIZE_PX } from './MarkerIconGeometry';
import { getMarkerShapeSize, resolveMarkerShapeRadius } from './MarkerShape';
import { getErrorMessage, hashString36 } from '../utils/Utilities';
import { sharedRegistryValue } from '../utils/CrossBundleRegistry';
import { logger } from '../utils/logger';
import { heapUsage } from '../utils/PerformanceMonitor';
import { readStoredPicture, storePicture } from './MarkerPictureStore';

export interface MarkerPicture {
  readonly width: number;
  readonly height: number;
  close?: () => void;
}

export type MarkerPictureLoader = (url: string, decodePx: number) => Promise<MarkerPicture>;

export const MARKER_PICTURE_CACHE_LIMIT = 128;
const MIN_SHORT_SIDE_FRACTION = 2 / 3;
const DECODE_CONCURRENCY = 12;
const HEAP_PRESSURE_RATIO = 0.7;
const PRESSURED_DECODE_CONCURRENCY = 3;
const MAX_BYTES_IN_FLIGHT = 64 * 1024 * 1024;
const ASSUMED_PICTURE_BYTES = 4 * 1024 * 1024;

function decodeConcurrency(): number {
  const usage = heapUsage();

  if (usage && usage.ratio >= HEAP_PRESSURE_RATIO) return PRESSURED_DECODE_CONCURRENCY;
  const average = loadTiming.pictures > 0 ? loadTiming.bytes / loadTiming.pictures : ASSUMED_PICTURE_BYTES;

  return Math.max(2, Math.min(DECODE_CONCURRENCY, Math.floor(MAX_BYTES_IN_FLIGHT / Math.max(average, 1))));
}

const UNDECODABLE_EXTENSIONS: ReadonlySet<string> = new Set([
  'dng', 'arw', 'cr2', 'cr3', 'nef', 'orf', 'raf', 'rw2', 'srw', 'pef', 'x3f', 'erf', 'kdc', 'mrw', 'sr2',
]);

function isUndecodable(url: string): boolean {
  const withoutQuery = url.split(/[?#]/)[0];
  const extension = withoutQuery.slice(withoutQuery.lastIndexOf('.') + 1).toLowerCase();

  return UNDECODABLE_EXTENSIONS.has(extension);
}

interface CachedPicture {
  picture: MarkerPicture;
  decodePx: number;
}

interface PictureCacheState {
  entries: Map<string, CachedPicture>;
  pending: Map<string, Promise<void>>;
  failed: Set<string>;
  undecodable: Set<string>;
  limit: number;
}

const CACHE_KEY = Symbol.for('places.marker.pictures');

function cache(): PictureCacheState {
  return sharedRegistryValue<PictureCacheState>(CACHE_KEY, () => ({
    entries: new Map(), pending: new Map(), failed: new Set(), undecodable: new Set(), limit: MARKER_PICTURE_CACHE_LIMIT,
  }));
}

export function getMarkerPicture(url: string, decodePx: number): MarkerPicture | undefined {
  const state = cache();
  const entry = state.entries.get(url);

  if (!entry || entry.decodePx !== decodePx) return undefined;
  state.entries.delete(url);
  state.entries.set(url, entry);

  return entry.picture;
}

export function markerPictureFailed(url: string): boolean {
  return cache().failed.has(url);
}

export function markerPictureFailureCounts(): { undecodable: number; unread: number } {
  const state = cache();

  return { undecodable: state.undecodable.size, unread: state.failed.size - state.undecodable.size };
}

export function markerPictureFailedCount(): number {
  return cache().failed.size;
}

export function releaseMarkerPicture(url: string): void {
  const state = cache();
  const entry = state.entries.get(url);

  if (!entry) return;
  entry.picture.close?.();
  state.entries.delete(url);
}

export async function loadMarkerPictures(urls: readonly string[], load: MarkerPictureLoader, decodePx: number): Promise<boolean> {
  const state = cache();
  const wanted = new Set<string>();

  for (const url of urls) {
    if (!url || state.entries.get(url)?.decodePx === decodePx || state.failed.has(url)) continue;

    if (isUndecodable(url)) {
      state.failed.add(url);
      state.undecodable.add(url);
      continue;
    }

    wanted.add(url);
  }

  if (wanted.size === 0) return false;

  let landed = false;
  const queue = [...wanted];
  const workers = Array.from({ length: Math.min(decodeConcurrency(), queue.length) }, async () => {
    for (let url = queue.shift(); url !== undefined; url = queue.shift()) {
      const pendingKey = `${decodePx}:${url}`;
      const existing = state.pending.get(pendingKey);

      if (existing) { await existing; continue; }
      const decode = load(url, decodePx).then(picture => {
        state.entries.get(url)?.picture.close?.();
        state.entries.set(url, { picture, decodePx });

        while (state.entries.size > state.limit) {
          const oldest = state.entries.keys().next().value;

          if (oldest === undefined) break;
          state.entries.get(oldest)?.picture.close?.();
          state.entries.delete(oldest);
        }

        landed = true;
      }).catch((error: unknown) => {
        state.failed.add(url);
        logger.scope('MapSurface').debug('Marker picture failed', { url, error: getErrorMessage(error) });
      }).finally(() => { state.pending.delete(pendingKey); });

      state.pending.set(pendingKey, decode);

      await decode;
    }
  });

  await Promise.all(workers);

  return landed;
}

export const domPictureLoader: MarkerPictureLoader = async (url, decodePx) => {
  const scaled = await decodeFromBytes(url, decodePx);

  if (scaled) return scaled;

  return await decodeThroughElement(url, decodePx);
};

async function decodeFromBytes(url: string, decodePx: number): Promise<MarkerPicture | undefined> {
  if (typeof fetch !== 'function' || typeof createImageBitmap !== 'function') return undefined;

  const stored = await readStoredPicture(url, decodePx);

  if (stored) {
    try {
      const thumbnail = await createImageBitmap(stored);

      loadTiming.storeHits++;

      return thumbnail;
    } catch (error) {
      logger.scope('MapSurface').debug('Cached marker picture could not be decoded', { url, error: getErrorMessage(error) });
    }
  }

  try {
    const readStarted = performance.now();
    const response = await fetch(url);

    if (!response.ok) return undefined;
    const bytes = await response.blob();
    const decodeStarted = performance.now();

    loadTiming.readMs += decodeStarted - readStarted;
    loadTiming.bytes += bytes.size;

    try {
      const wide = await createImageBitmap(bytes, { resizeWidth: decodePx, resizeQuality: 'high' });

      if (wide.height >= decodePx * MIN_SHORT_SIDE_FRACTION) {
        void storePicture(url, wide, decodePx);

        return wide;
      }

      wide.close();
      const tall = await createImageBitmap(bytes, { resizeHeight: decodePx, resizeQuality: 'high' });

      void storePicture(url, tall, decodePx);

      return tall;
    } finally {
      loadTiming.decodeMs += performance.now() - decodeStarted;
      loadTiming.pictures++;
    }
  } catch {
    return undefined;
  }
}

const loadTiming = { readMs: 0, decodeMs: 0, bytes: 0, pictures: 0, storeHits: 0 };

export function takeMarkerPictureLoadTiming(): { readMs: number; decodeMs: number; megabytes: number; fromOriginal: number; fromStore: number } {
  const taken = {
    readMs: Math.round(loadTiming.readMs),
    decodeMs: Math.round(loadTiming.decodeMs),
    megabytes: Math.round(loadTiming.bytes / 1048576),
    fromOriginal: loadTiming.pictures,
    fromStore: loadTiming.storeHits,
  };

  loadTiming.readMs = 0;
  loadTiming.decodeMs = 0;
  loadTiming.bytes = 0;
  loadTiming.pictures = 0;
  loadTiming.storeHits = 0;

  return taken;
}

async function decodeThroughElement(url: string, decodePx: number): Promise<MarkerPicture> {
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const element = new Image();

    element.onload = () => resolve(element);
    element.onerror = () => reject(new Error(`Marker picture did not load: ${url}`));
    element.decoding = 'async';
    element.src = url;
  });

  return await resampleToMarkerSize(image, decodePx);
}

async function resampleToMarkerSize(image: HTMLImageElement, decodePx: number): Promise<MarkerPicture> {
  const shortSide = Math.min(image.naturalWidth, image.naturalHeight);

  if (!shortSide || shortSide <= decodePx || typeof createImageBitmap !== 'function') return image;
  const scale = decodePx / shortSide;

  try {
    return await createImageBitmap(image, {
      resizeWidth: Math.max(1, Math.round(image.naturalWidth * scale)),
      resizeHeight: Math.max(1, Math.round(image.naturalHeight * scale)),
      resizeQuality: 'high',
    });
  } catch {
    return image;
  }
}

export function markerPictureImageId(url: string, style: ComputedIconStyle | undefined, quality: IconImageQuality): string {
  return `places-picture-${hashString36(JSON.stringify({ url, shape: style?.shape, scale: getMaxIconScale(style), quality, layout: 1 }))}`;
}

interface PictureContext {
  save(): void;
  restore(): void;
  beginPath(): void;
  moveTo(x: number, y: number): void;
  arcTo(x1: number, y1: number, x2: number, y2: number, radius: number): void;
  closePath(): void;
  clip(): void;
  drawImage(image: MarkerPicture, x: number, y: number, width: number, height: number): void;
}

export function drawMarkerPicture(context: PictureContext, picture: MarkerPicture, box: { centerX: number; centerY: number; size: number }, shape: IconShapeStyle | undefined, pixelRatio: number): void {
  const strokeWidth = shape?.stroke ? shape.strokeWidth * pixelRatio : 0;
  const size = Math.max(0, box.size - strokeWidth);

  if (size <= 0 || picture.width <= 0 || picture.height <= 0) return;

  const left = box.centerX - size / 2;
  const top = box.centerY - size / 2;
  const radius = resolveMarkerShapeRadius(shape ?? defaultPictureShape(), size);

  context.save();
  context.beginPath();
  context.moveTo(left + radius, top);
  context.arcTo(left + size, top, left + size, top + size, radius);
  context.arcTo(left + size, top + size, left, top + size, radius);
  context.arcTo(left, top + size, left, top, radius);
  context.arcTo(left, top, left + size, top, radius);
  context.closePath();
  context.clip();

  const scale = Math.max(size / picture.width, size / picture.height);
  const width = picture.width * scale;
  const height = picture.height * scale;

  context.drawImage(picture, box.centerX - width / 2, box.centerY - height / 2, width, height);
  context.restore();
}

export function markerPictureCssUrl(url: string): string {
  return `url("${url.replace(/[\\"]/g, character => `\\${character}`).replace(/[\r\n]/g, '')}")`;
}

export function defaultPictureShape(): IconShapeStyle {
  return { strokeWidth: 0, radius: { value: 0, unit: 'px' } };
}

export function getMarkerPictureSize(style: ComputedIconStyle | undefined): number {
  return getMarkerShapeSize(MARKER_ICON_SIZE_PX * getMaxIconScale(style));
}
