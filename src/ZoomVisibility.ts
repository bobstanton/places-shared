// Zoom below which place labels are suppressed, on every provider.
export const MIN_ZOOM_FOR_LABELS = 10;

// Smallest nudge past an inclusive bound. Far below the ~0.01 granularity zoom
// ranges are written at, and far above float-comparison noise at zoom scale.
const ZOOM_EPSILON = 1e-6;

// A `maxZoom` from settings as MapLibre GL's `maxzoom`.
//
// Places treats `maxZoom` as inclusive: visible AT that zoom and hidden the
// moment the zoom passes it, which is what Leaflet's `currentZoom > maxZoom` does and
// what the symbol layers' `<= maxZoom` filter does. GL's `maxzoom` hides at
// `zoom >= maxzoom`, and the bound is nudged just past the setting rather than
// rounded up: adding a whole level would keep the layer alive across the entire
// next zoom step, overlapping any layer (e.g. a `minZoom: 12.01` successor)
// designed to replace it.
export function toGlMaxZoom(maxZoom: number): number {
  return maxZoom + ZOOM_EPSILON;
}

import { normalizePropertyName } from './utils/Utilities';
import { coerceScalarString } from './utils/Utilities';

export interface ZoomRange {
  minZoom?: number;
  maxZoom?: number;
}

const MIN_ZOOM = 0;
const MAX_ZOOM = 24;

export function normalizeZoomValue(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const parsed = typeof value === 'number' ? value : Number(coerceScalarString(value).trim());
  if (!Number.isFinite(parsed)) return undefined;
  return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Math.floor(parsed)));
}

export function normalizeZoomRange(range: ZoomRange | undefined): ZoomRange | undefined {
  if (!range) return undefined;
  const minZoom = normalizeZoomValue(range.minZoom);
  const maxZoom = normalizeZoomValue(range.maxZoom);
  if (minZoom === undefined && maxZoom === undefined) return undefined;
  if (minZoom !== undefined && maxZoom !== undefined && minZoom > maxZoom) {
    return { minZoom: maxZoom, maxZoom: minZoom };
  }
  return { minZoom, maxZoom };
}

export function mergeZoomRanges(...ranges: Array<ZoomRange | undefined>): ZoomRange | undefined {
  let minZoom: number | undefined;
  let maxZoom: number | undefined;

  for (const range of ranges) {
    const normalized = normalizeZoomRange(range);
    if (!normalized) continue;
    if (normalized.minZoom !== undefined) {
      minZoom = minZoom === undefined ? normalized.minZoom : Math.max(minZoom, normalized.minZoom);
    }
    if (normalized.maxZoom !== undefined) {
      maxZoom = maxZoom === undefined ? normalized.maxZoom : Math.min(maxZoom, normalized.maxZoom);
    }
  }

  return normalizeZoomRange({ minZoom, maxZoom });
}

export function readZoomRangeFromRecord(record: Record<string, unknown> | undefined, prefix = ''): ZoomRange | undefined {
  return readZoomRangesFromRecord(record, [prefix])[prefix];
}

// Resolve multiple zoom namespaces; normalize the record's keys once.
export function readZoomRangesFromRecord(record: Record<string, unknown> | undefined, prefixes: readonly string[]): Record<string, ZoomRange | undefined> {
  const ranges: Record<string, ZoomRange | undefined> = {};
  if (!record) {
    for (const prefix of prefixes) ranges[prefix] = undefined;
    return ranges;
  }

  const normalizedRecord = new Map<string, unknown>(
    Object.entries(record).map(([key, value]) => [normalizePropertyName(key), value])
  );
  for (const prefix of prefixes) {
    ranges[prefix] = readZoomRangeFromNormalizedRecord(normalizedRecord, prefix);
  }
  return ranges;
}

function readZoomRangeFromNormalizedRecord(normalizedRecord: Map<string, unknown>, prefix: string): ZoomRange | undefined {
  const normalizedPrefix = normalizePropertyName(prefix);

  return normalizeZoomRange({
    minZoom: normalizeZoomValue(normalizedRecord.get(`${normalizedPrefix}minzoom`)),
    maxZoom: normalizeZoomValue(normalizedRecord.get(`${normalizedPrefix}maxzoom`)),
  });
}

export function getZoomRangeClassNames(range: ZoomRange | undefined): string[] {
  const normalized = normalizeZoomRange(range);
  if (!normalized) return [];
  return [
    normalized.minZoom !== undefined ? `places-min-zoom-${normalized.minZoom}` : '',
    normalized.maxZoom !== undefined ? `places-max-zoom-${normalized.maxZoom}` : '',
  ].filter(Boolean);
}

export function updateZoomContainerState(container: HTMLElement, zoom: number): void {
  const bucket = normalizeZoomValue(zoom) ?? MIN_ZOOM;
  const previousBucket = Number(container.dataset.placesZoomBucket);
  if (previousBucket === bucket) return;

  if (Number.isFinite(previousBucket)) {
    container.classList.remove(`places-zoom-${previousBucket}`);
    for (let threshold = MIN_ZOOM; threshold <= MAX_ZOOM; threshold++) {
      container.classList.remove(`places-zoom-lt-${threshold}`, `places-zoom-gt-${threshold}`);
    }
  }

  container.dataset.placesZoomBucket = String(bucket);
  container.classList.add(`places-zoom-${bucket}`);
  for (let threshold = MIN_ZOOM; threshold <= MAX_ZOOM; threshold++) {
    if (bucket < threshold) container.classList.add(`places-zoom-lt-${threshold}`);
    if (bucket > threshold) container.classList.add(`places-zoom-gt-${threshold}`);
  }
  container.setCssProps({ '--map-zoom': String(bucket) });
}
