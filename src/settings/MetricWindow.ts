import { Kilometers, km } from '../Units';
import { coerceScalarString } from '../utils/Utilities';

// The span a rolling track metric is computed over. Time windows need
// per-point timestamps. Consumers without them (track coloring, which renders
// from stored elevations only) reject a time window.
export type MetricWindow =
  | { readonly kind: 'distance'; readonly km: number }
  | { readonly kind: 'time'; readonly ms: number };

export const DEFAULT_SPEED_WINDOW: MetricWindow = { kind: 'distance', km: 0.2 };
// 100 ft.
export const DEFAULT_GRADE_WINDOW: MetricWindow = { kind: 'distance', km: 0.03048 };

export class MetricWindowError extends Error {
  constructor(rawValue: string) {
    super(`Invalid window "${rawValue}". Use a distance such as 200m, 500ft, 0.25mi, or a time such as 30s, 10min, 1h.`);
    this.name = 'MetricWindowError';
  }
}

export const KM_PER_UNIT: ReadonlyArray<readonly [RegExp, number]> = [
  [/^(?:m|meter|meters)$/, 0.001],
  [/^(?:km|kilometer|kilometers)$/, 1],
  [/^(?:ft|foot|feet)$/, 0.0003048],
  [/^(?:mi|mile|miles)$/, 1.609344],
  [/^(?:yd|yard|yards)$/, 0.0009144],
];

const MS_PER_UNIT: ReadonlyArray<readonly [RegExp, number]> = [
  [/^(?:s|sec|secs|second|seconds)$/, 1000],
  [/^(?:min|mins|minute|minutes)$/, 60_000],
  [/^(?:h|hr|hrs|hour|hours)$/, 3_600_000],
];

// `m` is meters and `min` is minutes: the unit is matched as a whole token
// rather than by prefix - `10m` and `10min` must not collide.
const WINDOW_PATTERN = /^(\d+(?:\.\d+)?)\s*([a-z]+)$/;

// Parse a `speedWindow` / `gradeWindow` value. A bare number is rejected,
// never read as feet.
// @throws MetricWindowError when the value is present but unrecognized.
export function parseMetricWindow(value: unknown, fallback: MetricWindow): MetricWindow {
  if (value === undefined || value === null || value === '') return fallback;

  // coerceScalarString maps a list or map to '', which must not be mistaken for
  // the absent case above.
  const scalar = coerceScalarString(value);

  if (!scalar) throw new MetricWindowError(Array.isArray(value) ? 'a list' : 'a map');

  const raw = scalar.trim();

  if (!raw) return fallback;

  const match = raw.toLowerCase().match(WINDOW_PATTERN);

  if (!match) throw new MetricWindowError(raw);

  const amount = Number(match[1]);

  if (!Number.isFinite(amount) || amount <= 0) throw new MetricWindowError(raw);

  // Rounded to millimeter / millisecond precision: the formatted window is a
  // cache key, and `100ft` and `30.48m` must land on one entry.
  for (const [pattern, kmPerUnit] of KM_PER_UNIT) {
    if (pattern.test(match[2])) return { kind: 'distance', km: Number((amount * kmPerUnit).toFixed(6)) };
  }

  for (const [pattern, msPerUnit] of MS_PER_UNIT) {
    if (pattern.test(match[2])) return { kind: 'time', ms: Math.round(amount * msPerUnit) };
  }

  throw new MetricWindowError(raw);
}

// Drives syntax highlighting.
export function isMetricWindowValue(value: string): boolean {
  try {
    parseMetricWindow(value, DEFAULT_SPEED_WINDOW);

    return value.trim() !== '';
  } catch {
    return false;
  }
}

// The text form of a window, shared by the settings field, error messages,
// and the token that keys parsed-track caches.
export function formatMetricWindow(window: MetricWindow): string {
  if (window.kind === 'time') {
    if (window.ms % 3_600_000 === 0) return `${window.ms / 3_600_000}h`;
    if (window.ms % 60_000 === 0) return `${window.ms / 60_000}min`;

    return `${window.ms / 1000}s`;
  }

  const meters = window.km * 1000;

  return meters >= 1000 && meters % 1000 === 0 ? `${meters / 1000}km` : `${Number(meters.toFixed(3))}m`;
}

// The window as kilometers, or undefined for a time window.
export function metricWindowKm(window: MetricWindow): Kilometers | undefined {
  return window.kind === 'distance' ? km(window.km) : undefined;
}

export function timeWindowUnsupportedMessage(setting: string, window: MetricWindow): string {
  return `${setting}: ${formatMetricWindow(window)} is a time window, which needs per-point timestamps. Use a distance such as 200m here.`;
}
