import { logger } from './logger';

const PLACES_STACK_PATTERN = /(?:plugin:places(?:[-/:]|\b)|places-(?:maplibre|utilities|openfreemap|mapbox|maptiler|radar|leaflet|geoapify|stadia|thunderforest))/i;
const DUPLICATE_WINDOW_MS = 5_000;
const CASCADE_WINDOW_MS = 2_000;

interface CapturedRuntimeError {
  error: Error;
  source?: string;
  line?: number;
  column?: number;
}

function asError(value: unknown, fallback: string): Error {
  if (value instanceof Error) return value;
  if (typeof value === 'string') return new Error(value);
  try { return new Error(JSON.stringify(value) ?? fallback); }
  catch { return new Error(fallback); }
}

export function isPlacesRuntimeError(error: Error, source?: string): boolean {
  return PLACES_STACK_PATTERN.test(`${source ?? ''}\n${error.stack ?? ''}`);
}

export function installPlacesGlobalErrorCapture(target: Window = window): () => void {
  const recent = new Map<string, number>();
  let lastCapturedAt = 0;
  const scoped = logger.scope('GlobalError');

  const capture = (kind: 'error' | 'unhandledrejection', captured: CapturedRuntimeError) => {
    if (!isPlacesRuntimeError(captured.error, captured.source)) return;
    const now = Date.now();
    for (const [key, timestamp] of recent) if (now - timestamp > DUPLICATE_WINDOW_MS) recent.delete(key);
    const fingerprint = `${kind}:${captured.error.name}:${captured.error.message}:${captured.error.stack?.split('\n')[1] ?? captured.source ?? ''}`;
    if (recent.has(fingerprint)) return;
    recent.set(fingerprint, now);
    const possiblyCascading = lastCapturedAt > 0 && now - lastCapturedAt <= CASCADE_WINDOW_MS;
    lastCapturedAt = now;
    scoped.error(kind === 'error' ? 'Uncaught Places runtime error' : 'Unhandled Places promise rejection', captured.error, {
      kind,
      source: captured.source,
      line: captured.line,
      column: captured.column,
      possiblyCascading,
    });
  };

  const onError = (event: ErrorEvent) => capture('error', {
    error: asError(event.error ?? event.message, 'Unknown runtime error'),
    source: event.filename,
    line: event.lineno,
    column: event.colno,
  });
  const onUnhandledRejection = (event: PromiseRejectionEvent) => capture('unhandledrejection', {
    error: asError(event.reason, 'Unhandled promise rejection'),
  });
  target.addEventListener('error', onError);
  target.addEventListener('unhandledrejection', onUnhandledRejection);
  return () => {
    target.removeEventListener('error', onError);
    target.removeEventListener('unhandledrejection', onUnhandledRejection);
  };
}
