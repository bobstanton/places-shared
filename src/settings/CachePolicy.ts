import { coerceScalarString } from '../utils/Utilities';

// The cache model shared by every `cache:` setting in every code block
// (weather, tides, solar, directions, isochrones) and by the VaultQuery
// definition blocks that wrap them.
//
// A policy is always the resolved form of one `cache:` value. Services never
// read the raw string: they parse once with `parseCacheSetting`.
export interface CachePolicy {
  // false bypasses the cache: no read, no write.
  readonly enabled: boolean;
  // Explicit entry-age limit in ms.
  // `undefined` means "whatever this service considers fresh" (its own default).
  // `Infinity` means the entry never goes stale from age alone.
  readonly maxAgeMs?: number;
  // Absolute epoch ms at which cached data goes stale no matter how young it
  // is. Set by a date value such as `cache: 2027-01-01`.
  readonly expiresAt?: number;
}

// `cache: true` - cache using the service's own default freshness.
export const CACHE_DEFAULT: CachePolicy = { enabled: true };

// `cache: false` - never read from or write to the cache.
export const CACHE_DISABLED: CachePolicy = { enabled: false };

// `cache: forever` - cached data never goes stale.
export const CACHE_FOREVER: CachePolicy = { enabled: true, maxAgeMs: Infinity };

export class CacheSettingError extends Error {
  constructor(rawValue: string) {
    super(`Invalid cache value "${rawValue}". Use true, false, forever, a duration such as 30m, 2h, or 7d, or an expiration date such as 2027-01-01.`);
    this.name = 'CacheSettingError';
  }
}

const MS = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000, w: 604_800_000 } as const;

const DURATION_UNITS: ReadonlyArray<readonly [RegExp, number]> = [
  [/^(?:s|sec|secs|second|seconds)$/, MS.s],
  [/^(?:m|min|mins|minute|minutes)$/, MS.m],
  [/^(?:h|hr|hrs|hour|hours)$/, MS.h],
  [/^(?:d|day|days)$/, MS.d],
  [/^(?:w|wk|wks|week|weeks)$/, MS.w],
];

const TRUE_TOKENS = new Set(['true', 'yes', 'on', 'enabled']);
const FALSE_TOKENS = new Set(['false', 'no', 'off', 'disabled', 'none', 'never']);
const FOREVER_TOKENS = new Set(['forever', 'permanent', 'always']);

const DURATION_PATTERN = /^(\d+(?:\.\d+)?)\s*([a-z]+)$/;
// `2027-01-01`, `2027-01-01T18:30`, `2027-01-01 18:30:00`, and compact `20270101`.
const DATE_PATTERN = /^(\d{4})-?(\d{2})-?(\d{2})(?:[t ](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/;

// A bare date means "valid through the end of that day" - `cache: 2027-01-01`
// keeps data until 2027-01-01 23:59:59.999 local time. A date with a time means
// exactly that local instant.
function parseAbsoluteExpiry(token: string): number | null {
  const match = token.match(DATE_PATTERN);

  if (!match) return null;

  const [, year, month, day, hour, minute, second] = match;
  const hasTime = hour !== undefined;
  const date = hasTime
    ? new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second ?? 0), 0)
    : new Date(Number(year), Number(month) - 1, Number(day), 23, 59, 59, 999);

  // Rejects 2027-02-30 and 2027-13-01, which Date would silently roll over.
  if (date.getFullYear() !== Number(year) || date.getMonth() !== Number(month) - 1 || date.getDate() !== Number(day)) {
    return null;
  }

  if (hasTime && (Number(hour) > 23 || Number(minute) > 59 || Number(second ?? 0) > 59)) {
    return null;
  }

  return date.getTime();
}

function parseDuration(token: string): number | null {
  const match = token.match(DURATION_PATTERN);

  if (!match) return null;

  const amount = Number(match[1]);

  if (!Number.isFinite(amount) || amount < 0) return null;

  for (const [pattern, unitMs] of DURATION_UNITS) {
    if (pattern.test(match[2])) return amount * unitMs;
  }

  return null;
}

// An empty or absent value yields `fallback` (the block's default).
// @throws CacheSettingError when the value is present but unrecognized.
export function parseCacheSetting(value: unknown, fallback: CachePolicy = CACHE_DEFAULT): CachePolicy {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'boolean') return value ? CACHE_DEFAULT : CACHE_DISABLED;

  const raw = coerceScalarString(value).trim();

  if (!raw) return fallback;

  const token = raw.toLowerCase();

  if (TRUE_TOKENS.has(token)) return CACHE_DEFAULT;
  if (FALSE_TOKENS.has(token)) return CACHE_DISABLED;
  if (FOREVER_TOKENS.has(token)) return CACHE_FOREVER;

  const maxAgeMs = parseDuration(token);

  if (maxAgeMs !== null) return { enabled: true, maxAgeMs };

  const expiresAt = parseAbsoluteExpiry(token);

  if (expiresAt !== null) return { enabled: true, expiresAt };

  throw new CacheSettingError(raw);
}

// Drives syntax highlighting.
export function isCacheSettingValue(value: string): boolean {
  const token = value.trim().toLowerCase();

  if (!token) return false;

  return TRUE_TOKENS.has(token)
    || FALSE_TOKENS.has(token)
    || FOREVER_TOKENS.has(token)
    || parseDuration(token) !== null
    || parseAbsoluteExpiry(token) !== null;
}

// @param defaultMaxAgeMs What `cache: true` means for this service - the
//   weather TTL ladder, `Infinity` for data that never changes (solar) or that
//   has no age limit today (route overlays).
export function isCacheEntryStale(policy: CachePolicy, cachedAt: number, defaultMaxAgeMs: number, now: number = Date.now()): boolean {
  if (policy.expiresAt !== undefined && now >= policy.expiresAt) return true;

  const maxAge = policy.maxAgeMs ?? defaultMaxAgeMs;

  if (!Number.isFinite(maxAge)) return false;

  return now - cachedAt >= maxAge;
}

// When an entry cached at `cachedAt` stops being servable, or undefined when it
// never does. The earlier of the age limit and the absolute expiry wins.
export function cachePolicyExpiresAt(policy: CachePolicy, cachedAt: number, defaultMaxAgeMs: number): number | undefined {
  if (!policy.enabled || !Number.isFinite(cachedAt)) return undefined;

  const maxAge = policy.maxAgeMs ?? defaultMaxAgeMs;
  const ageLimit = Number.isFinite(maxAge) ? cachedAt + maxAge : undefined;

  if (ageLimit === undefined) return policy.expiresAt;
  if (policy.expiresAt === undefined) return ageLimit;

  return Math.min(ageLimit, policy.expiresAt);
}

// Entries the user asked to keep forever are exempt from capacity eviction.
export function cachePolicyRetention(policy: CachePolicy): 'forever' | undefined {
  return policy.enabled && policy.maxAgeMs === Infinity && policy.expiresAt === undefined ? 'forever' : undefined;
}

export function providerExpiresAt(policy: CachePolicy, cachedAt: number, defaultMaxAgeMs: number): number | undefined {
  const expiresAt = cachePolicyExpiresAt(policy, cachedAt, defaultMaxAgeMs);

  if (expiresAt !== undefined) return expiresAt;

  return cachePolicyRetention(policy) === 'forever' ? Date.UTC(9999, 0, 1) : undefined;
}

// Human-readable form for debug traces and log lines.
export function describeCachePolicy(policy: CachePolicy): string {
  if (!policy.enabled) return 'disabled';
  if (policy.expiresAt !== undefined) return `until ${new Date(policy.expiresAt).toLocaleString()}`;
  if (policy.maxAgeMs === Infinity) return 'forever';
  if (policy.maxAgeMs === undefined) return 'default';

  return `${Math.round(policy.maxAgeMs / 1000)}s`;
}

export interface CacheValueSuggestion {
  readonly value: string;
  readonly detail?: string;
}

export const CACHE_VALUE_SUGGESTIONS: readonly CacheValueSuggestion[] = [
  { value: 'true', detail: 'Default duration' },
  { value: 'false', detail: 'Bypass the cache' },
  { value: 'forever' },
  { value: '15m' },
  { value: '1h' },
  { value: '6h' },
  { value: '24h' },
  { value: '7d' },
  { value: '2027-01-01', detail: 'Expires at end of day, local time' },
];

// `values:` documentation string for the `cache` parameter of every block.
export const CACHE_PARAMETER_VALUES = '**true**, false, forever, 30m/2h/7d, 2027-01-01';

export const CACHE_PARAMETER_DESCRIPTION =
  'Duration or expiration date';
