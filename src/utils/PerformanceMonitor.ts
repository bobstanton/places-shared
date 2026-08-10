import { logger as rootLogger } from './logger';

type PerformanceDetails = Record<string, unknown>;

export interface PerformanceMonitor {
  mark(event: string, details?: PerformanceDetails): void;
  measure<T>(event: string, work: () => T, details?: PerformanceDetails, options?: { slowOnly?: boolean; thresholdMs?: number }): T;
  measureAsync<T>(event: string, work: () => Promise<T>, details?: PerformanceDetails, options?: { slowOnly?: boolean; thresholdMs?: number }): Promise<T>;
}

const DEFAULT_SLOW_THRESHOLD_MS = 16;
let nextRunId = 1;

function now(): number {
  return typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now();
}

function roundMs(value: number): number {
  return Math.round(value * 10) / 10;
}

const NOOP_MONITOR: PerformanceMonitor = {
  mark: () => undefined,
  measure: (_event, work) => work(),
  measureAsync: (_event, work) => work(),
};

// options.enabled: the developer-mode setting; false returns a shared no-op.
export function createPerformanceMonitor(name: string, baseDetails: PerformanceDetails = {}, options?: { enabled?: boolean }): PerformanceMonitor {
  if (options?.enabled === false) {
    return NOOP_MONITOR;
  }
  const perfLogger = rootLogger.scope('Performance');
  const start = now();
  const runId = nextRunId++;

  const write = (event: string, durationMs: number | null, details: PerformanceDetails | undefined, slow: boolean): void => {
    const payload = {
      monitor: name,
      runId,
      elapsedMs: roundMs(now() - start),
      ...(durationMs !== null ? { durationMs: roundMs(durationMs) } : {}),
      ...baseDetails,
      ...(details ?? {}),
    };
    const message = `[Places Performance] ${name}:${event}`;
    if (slow) {
      perfLogger.warn(message, payload);
    } else {
      perfLogger.debug(message, payload);
    }
  };

  return {
    mark(event, details) {
      write(event, null, details, false);
    },

    measure(event, work, details, options = {}) {
      const started = now();
      try {
        return work();
      } finally {
        const durationMs = now() - started;
        const thresholdMs = options.thresholdMs ?? DEFAULT_SLOW_THRESHOLD_MS;
        const slow = durationMs >= thresholdMs;
        if (!options.slowOnly || slow) {
          write(event, durationMs, { timing: 'sync-execution', ...(details ?? {}) }, slow);
        }
      }
    },

    async measureAsync(event, work, details, options = {}) {
      const started = now();
      try {
        return await work();
      } finally {
        const durationMs = now() - started;
        const thresholdMs = options.thresholdMs ?? DEFAULT_SLOW_THRESHOLD_MS;
        const slow = durationMs >= thresholdMs;
        if (!options.slowOnly || slow) {
          write(event, durationMs, { timing: 'async-wall', ...(details ?? {}) }, slow);
        }
      }
    },
  };
}
