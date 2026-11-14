import { createDebugLogger, type DebugLogger, type DebugLogSink } from 'obsidian-debug-logger';
import { sharedRegistryValue } from './CrossBundleRegistry';

// Provider plugins bundle their own copy of places-shared. Keep the logger on
// globalThis: every Places bundle writes to the same exportable debug buffer
// and receives the console-level configuration applied by the main plugin.
//
// This module is reachable from worker-safe.ts and initializes at import time,
// and `window` would throw when the bundle loads inside a worker.
const LOGGER_GLOBAL_KEY = '__placesDebugLogger';

// Four times the library's 500 default: a cold start of a nine-map note logs
// 800-1200 entries. Each entry retains references to the objects it logged
// (the library keeps `values: data.slice()`), and the exported clipboard
// string grows with the count.
const DEBUG_LOG_BUFFER_SIZE = 2000;

const consoleSink: DebugLogSink = (entry, args) => {
  const write = entry.level === 'error' ? console.error
    : entry.level === 'warn' ? console.warn
    : console.debug;

  write(...args);
};

const PERSISTENT_SINK_KEY = '__placesPersistentLogSink';

function persistentSinkHolder(): { sink?: DebugLogSink } {
  return sharedRegistryValue<{ sink?: DebugLogSink }>(PERSISTENT_SINK_KEY, () => ({}));
}

export function configurePersistentLogSink(sink: DebugLogSink | null): void {
  persistentSinkHolder().sink = sink ?? undefined;
}

const fanOutSink: DebugLogSink = (entry, args) => {
  consoleSink(entry, args);

  try {
    persistentSinkHolder().sink?.(entry, args);
  } catch {
    return;
  }
};

export const logger = sharedRegistryValue<DebugLogger>(LOGGER_GLOBAL_KEY, () => createDebugLogger('Places', {
  bufferSize: DEBUG_LOG_BUFFER_SIZE,
  sink: fanOutSink,
}));
