export type ApiUsageService = string;

export const API_USAGE_SERVICES = {
  geocoding: 'geocoding',
  elevation: 'elevation',
  routeOverlay: 'routeOverlay',
  snap: 'snap',
  trackMatch: 'trackMatch',
  tiles: 'tiles',
} as const;

export interface ApiUsageOrigin {
  sourcePath?: string;
  blockType?: string;
}

export interface ApiUsageEvent {
  provider: string;
  service: ApiUsageService;
  success: boolean;
  durationMs: number;
  origin?: ApiUsageOrigin;
  cached?: boolean;
}

export interface ApiUsageRecorder {
  record(event: ApiUsageEvent): void;
}

export async function trackApiUsage<T>(recorder: ApiUsageRecorder | undefined, event: { provider: string; service: ApiUsageService; origin?: ApiUsageOrigin }, fn: () => Promise<T>): Promise<T> {
  if (!recorder) return fn();

  const started = performance.now();
  let success = false;

  try {
    const result = await fn();

    success = true;

    return result;
  } finally {
    recorder.record({ ...event, success, durationMs: performance.now() - started });
  }
}
