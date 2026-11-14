import { logger as rootLogger } from './logger';

type PerformanceDetails = Record<string, unknown>;

export interface PerformanceMeasureOptions {
  slowOnly?: boolean;
  thresholdMs?: number;
  warnOnSlow?: boolean;
}

export interface PerformanceMonitor {
  mark(event: string, details?: PerformanceDetails): void;
  measure<T>(event: string, work: () => T, details?: PerformanceDetails, options?: PerformanceMeasureOptions): T;
  measureAsync<T>(event: string, work: () => Promise<T>, details?: PerformanceDetails, options?: PerformanceMeasureOptions): Promise<T>;
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

function markUserTiming(name: string, detail: PerformanceDetails): void {
  if (typeof performance === 'undefined' || typeof performance.mark !== 'function') return;

  try {
    performance.mark(name, { detail });
  } catch {
    return;
  }
}

const NOOP_MONITOR: PerformanceMonitor = {
  mark: () => undefined,
  measure: (_event, work) => work(),
  measureAsync: (_event, work) => work(),
};

export function createPerformanceMonitor(name: string, baseDetails: PerformanceDetails = {}, options?: { enabled?: boolean }): PerformanceMonitor {
  if (options?.enabled === false) {
    return NOOP_MONITOR;
  }

  const perfLogger = rootLogger.scope('Performance');
  const start = now();
  const runId = nextRunId++;

  const write = (event: string, durationMs: number | null, details: PerformanceDetails | undefined, slow: boolean): void => {
    const heapMB = heapUsedMB();
    const payload = {
      monitor: name,
      runId,
      elapsedMs: roundMs(now() - start),
      ...(durationMs !== null ? { durationMs: roundMs(durationMs) } : {}),
      ...(heapMB !== undefined ? { heapMB } : {}),
      ...baseDetails,
      ...(details ?? {}),
    };
    const message = `[Places Performance] ${name}:${event}`;

    markUserTiming(`places:${name}:${event}`, payload);

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
          write(event, durationMs, { timing: 'sync-execution', ...(details ?? {}) }, slow && options.warnOnSlow !== false);
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
          write(event, durationMs, { timing: 'async-wall', ...(details ?? {}) }, slow && options.warnOnSlow === true);
        }
      }
    },
  };
}

export function heapUsedMB(): number | undefined {
  return heapUsage()?.usedMB;
}

export interface HeapUsage {
  usedMB: number;
  limitMB: number;
  ratio: number;
}

export function heapUsage(): HeapUsage | undefined {
  const memory = (performance as unknown as { memory?: { usedJSHeapSize?: number; jsHeapSizeLimit?: number } }).memory;
  const used = memory?.usedJSHeapSize;
  const limit = memory?.jsHeapSizeLimit;

  if (typeof used !== 'number' || typeof limit !== 'number' || limit <= 0) return undefined;

  return { usedMB: Math.round(used / 1024 / 1024), limitMB: Math.round(limit / 1024 / 1024), ratio: used / limit };
}

const HEAP_WARNING_RATIOS = [0.6, 0.75, 0.85, 0.95];
let heapWarningsReported = 0;

export function reportHeapPressure(report: (usage: HeapUsage) => void): void {
  const usage = heapUsage();

  if (!usage) return;

  while (heapWarningsReported < HEAP_WARNING_RATIOS.length && usage.ratio >= HEAP_WARNING_RATIOS[heapWarningsReported]) {
    heapWarningsReported++;
    report(usage);
  }
}
