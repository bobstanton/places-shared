// Rate limiting driven by the standard rate-limit response headers
// (x-ratelimit-* and Mapbox-style x-rate-limit-*, plus retry-after on 429). An
// instance that sends no such headers is never limited.
//
// Requests are never pre-emptively spaced; callers wait only after the server
// reports the quota is exhausted.
import { sleep } from '../utils/Utilities';

export class ProviderRateLimitTracker {
  private buckets = new Map<string, number>();
  private queues = new Map<string, Promise<void>>();

  async runExclusive<T>(bucket: string, work: () => Promise<T>): Promise<T> {
    const previous = this.queues.get(bucket) ?? Promise.resolve();
    const run = previous.then(work);

    this.queues.set(bucket, run.then(() => undefined, () => undefined));

    try {
      return await run;
    } finally {
      if (this.queues.get(bucket) === run) {
        this.queues.delete(bucket);
      }
    }
  }

  // Wait until the given bucket has capacity again (no-op unless the server reported exhaustion).
  async waitForCapacity(bucket: string): Promise<void> {
    const resumeAt = this.buckets.get(bucket);

    if (resumeAt === undefined) return;

    const waitMs = resumeAt - Date.now();

    if (waitMs > 0) {
      await sleep(waitMs);
    }

    this.buckets.delete(bucket);
  }

  // Returns true when the request was 429-rejected and should be retried after waitForCapacity().
  recordResponse(bucket: string, status: number, headers: Record<string, string>): boolean {
    const normalized = normalizeHeaderKeys(headers);

    if (status === 429) {
      this.buckets.set(bucket, resolveRetryTime(normalized));

      return true;
    }

    const remaining = Number.parseFloat(normalized['x-ratelimit-remaining'] ?? normalized['x-rate-limit-remaining'] ?? '');

    if (Number.isFinite(remaining) && remaining <= 0) {
      const reset = parseResetTimestamp(normalized['x-ratelimit-reset'] ?? normalized['x-rate-limit-reset']);

      if (reset !== null) {
        this.buckets.set(bucket, reset);

        return false;
      }
    }

    this.buckets.delete(bucket);

    return false;
  }
}

// Run a request through a rate-limit tracker, retrying once after a 429.
export async function executeRateLimited<T extends { status: number; headers: Record<string, string> }>(tracker: ProviderRateLimitTracker, bucket: string, execute: () => Promise<T>): Promise<T> {
  return tracker.runExclusive(bucket, async () => {
    for (let attempt = 0; ; attempt++) {
      await tracker.waitForCapacity(bucket);
      const response = await execute();
      const rateLimited = tracker.recordResponse(bucket, response.status, response.headers);

      if (!rateLimited || attempt > 0) {
        return response;
      }
    }
  });
}

// For APIs whose published usage policy asks for a maximum request rate
// (Nominatim's 1/s, GeoNames) rather than communicating quotas through
// response headers.
export class FixedIntervalRateLimiter {
  private lastRequestTime = 0;

  constructor(private readonly minIntervalMs: number) {}

  async wait(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;

    if (elapsed < this.minIntervalMs) {
      await sleep(this.minIntervalMs - elapsed);
    }

    this.lastRequestTime = Date.now();
  }
}

function normalizeHeaderKeys(headers: Record<string, string>): Record<string, string> {
  const normalized: Record<string, string> = {};

  for (const [key, value] of Object.entries(headers ?? {})) {
    normalized[key.toLowerCase()] = value;
  }

  return normalized;
}

function resolveRetryTime(headers: Record<string, string>): number {
  const retryAfter = headers['retry-after'];

  if (retryAfter) {
    const seconds = Number.parseFloat(retryAfter);

    if (Number.isFinite(seconds)) return Date.now() + seconds * 1000;

    const date = Date.parse(retryAfter);

    if (Number.isFinite(date)) return date;
  }

  const reset = parseResetTimestamp(headers['x-ratelimit-reset'] ?? headers['x-rate-limit-reset']);

  if (reset !== null) return reset;

  // The server rejected the request without saying when to come back.
  return Date.now() + 5_000;
}

// Reset headers are epoch seconds in most APIs, epoch milliseconds in some.
function parseResetTimestamp(value: string | undefined): number | null {
  const parsed = Number.parseFloat(value ?? '');

  if (!Number.isFinite(parsed) || parsed <= 0) return null;

  return parsed > 1e12 ? parsed : parsed * 1000;
}
