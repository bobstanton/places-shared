export interface TileFailureReport {
  host: string;
  status?: number;
  failureCount: number;
}

export interface TileFailureMonitorOptions {
  onChange: (report: TileFailureReport | undefined) => void;
  settleMs?: number;
  setTimer?: (callback: () => void, ms: number) => number;
  clearTimer?: (handle: number) => void;
}

export class TileFailureMonitor {
  private successes = 0;
  private failures = 0;
  private host = '';
  private status: number | undefined;
  private timer: number | undefined;
  private reported = false;
  private disposed = false;
  private readonly settleMs: number;
  private readonly setTimer: (callback: () => void, ms: number) => number;
  private readonly clearTimer: (handle: number) => void;

  constructor(private readonly options: TileFailureMonitorOptions) {
    this.settleMs = options.settleMs ?? 750;
    this.setTimer = options.setTimer ?? ((callback, ms) => window.setTimeout(callback, ms));
    this.clearTimer = options.clearTimer ?? ((handle) => window.clearTimeout(handle));
  }

  recordSuccess(): void {
    if (this.disposed) return;
    this.successes++;
    this.schedule();
  }

  recordFailure(url: string, error?: unknown): void {
    if (this.disposed) return;
    this.failures++;
    this.host = tileHost(url) || this.host;
    this.status = tileStatus(error) ?? this.status;
    this.schedule();
  }

  dispose(): void {
    this.disposed = true;
    if (this.timer !== undefined) this.clearTimer(this.timer);
    this.timer = undefined;
  }

  private schedule(): void {
    if (this.timer !== undefined) this.clearTimer(this.timer);
    this.timer = this.setTimer(() => this.settle(), this.settleMs);
  }

  private settle(): void {
    this.timer = undefined;
    if (this.disposed) return;

    const blank = this.successes === 0 && this.failures > 0;
    if (blank && !this.reported) {
      this.reported = true;
      this.options.onChange({ host: this.host, status: this.status, failureCount: this.failures });
    } else if (!blank && this.reported) {
      this.reported = false;
      this.options.onChange(undefined);
    }

    this.successes = 0;
    this.failures = 0;
  }
}

export function describeTileFailure(report: TileFailureReport): string {
  const where = report.host ? ` from ${report.host}` : '';
  if (report.status === 404) {
    return `No map tiles loaded${where}. The server returned 404 (not found), so the tile source probably does not cover this area or zoom level.`;
  }
  if (report.status === 401 || report.status === 403) {
    return `No map tiles loaded${where}. The server returned ${report.status}, which usually means a missing or rejected API key.`;
  }
  if (report.status !== undefined) {
    return `No map tiles loaded${where}. The server returned ${report.status}.`;
  }
  return `No map tiles loaded${where}.`;
}

function tileHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return '';
  }
}

function tileStatus(error: unknown): number | undefined {
  const reported = (error as { status?: unknown } | undefined)?.status;
  if (typeof reported === 'number') return reported;

  // Obsidian's requestUrl rejects with "Request failed, status 404".
  const message = error instanceof Error ? error.message : typeof error === 'string' ? error : '';
  const match = message.match(/\bstatus[:\s]+(\d{3})\b/i);
  return match ? Number(match[1]) : undefined;
}
