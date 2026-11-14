import { logger } from '../../utils/index';
import type { TileCacheFetchResult } from './TileCache';

interface Consumer {
  resolve(value: TileCacheFetchResult): void;
  reject(error: unknown): void;
  release(): void;
}
interface HostState { active: number; failures: number; retryAt: number; probing: boolean; backoff: number }
interface Job {
  key: string;
  url: string;
  host: HostState;
  fetcher(): Promise<TileCacheFetchResult>;
  onSuccess?(value: TileCacheFetchResult): void;
  consumers: Set<Consumer>;
  started: boolean;
  probe?: boolean;
  error?: Error;
  timer: number;
}

const DEADLINE_MS = 15_000;
const MAX_ACTIVE_PER_HOST = 6;
const MAX_QUEUED = 64;

function abortError(): DOMException { return new DOMException('Map request canceled', 'AbortError'); }

function transient(error: unknown): boolean {
  const status = (error as { status?: number })?.status
    ?? Number(/\bstatus[:\s]+(\d{3})\b/i.exec(String(error))?.[1]);

  return !status || status === 429 || status >= 500;
}

export class TileRequestQueue {
  private jobs = new Map<string, Job>();
  private hosts = new Map<string, HostState>();
  private queued: Job[] = [];
  private recoveryListeners = new Set<(host: string) => void>();

  onRecovery(listener: (host: string) => void): () => void {
    this.recoveryListeners.add(listener);

    return () => { this.recoveryListeners.delete(listener); };
  }

  get pendingCount(): number { return this.jobs.size; }

  hasPending(key: string): boolean { return this.jobs.has(key); }

  retryNow(url: string): void { this.host(url).retryAt = 0; }

  isDegraded(url: string): boolean { return this.host(url).failures >= 2; }

  request(key: string, url: string, fetcher: () => Promise<TileCacheFetchResult>, signal?: AbortSignal, onSuccess?: (value: TileCacheFetchResult) => void): Promise<TileCacheFetchResult> {
    if (signal?.aborted) return Promise.reject(abortError());
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return Promise.reject(new Error('Map resource unavailable offline'));
    let job = this.jobs.get(key);

    if (job?.error) return Promise.reject(job.error);

    if (!job) {
      const host = this.host(url);

      if (host.retryAt > Date.now()) return Promise.reject(new Error('Map requests paused after network failures'));
      if (this.queued.length >= MAX_QUEUED) return Promise.reject(new Error('Map request queue full'));
      job = { key, url, host, fetcher, onSuccess, consumers: new Set(), started: false,
        timer: window.setTimeout(() => this.timeout(job!), DEADLINE_MS) };
      this.jobs.set(key, job);
      this.queued.push(job);
    }

    const current = job;
    const result = new Promise<TileCacheFetchResult>((resolve, reject) => {
      const cancel = () => {
        current.consumers.delete(consumer);
        consumer.release();
        reject(abortError());
        if (!current.started && !current.consumers.size) this.remove(current);
      };
      const consumer: Consumer = { resolve, reject, release: () => signal?.removeEventListener('abort', cancel) };

      current.consumers.add(consumer);
      signal?.addEventListener('abort', cancel, { once: true });
    });

    this.pump();

    return result;
  }

  private host(url: string): HostState {
    const name = new URL(url).host;
    let host = this.hosts.get(name);

    if (!host) { host = { active: 0, failures: 0, retryAt: 0, probing: false, backoff: 5000 }; this.hosts.set(name, host); }

    return host;
  }

  private pump(): void {
    for (const job of [...this.queued]) {
      const host = job.host;

      if (host.retryAt > Date.now()) {
        this.reject(job, new Error('Map requests paused after network failures'));
        this.remove(job);
        continue;
      }

      if (host.active >= MAX_ACTIVE_PER_HOST || host.probing) continue;
      this.queued.splice(this.queued.indexOf(job), 1);
      job.started = true;
      host.active++;
      job.probe = host.failures >= 2;
      if (job.probe) host.probing = true;
      void Promise.resolve().then(() => job.fetcher()).then(value => {
        const recovered = host.failures > 0;

        host.failures = 0; host.retryAt = 0; host.backoff = 5000;

        try {
 job.onSuccess?.(value); 
} catch (error) {
 logger.scope('TileCache').debug('tile cache write failed', error); 
}

        if (recovered) for (const listener of this.recoveryListeners) listener(new URL(job.url).host);
        for (const consumer of job.consumers) { consumer.release(); consumer.resolve(value); }
        job.consumers.clear();
      }, (error: unknown) => {
        if (!job.error) this.failed(job, error);
        this.reject(job, error);
      }).finally(() => {
        host.active--;
        if (job.probe) host.probing = false;
        this.remove(job);
        this.pump();
      });
    }
  }

  private timeout(job: Job): void {
    const error = new Error(`Tile request exceeded ${DEADLINE_MS} ms`);

    if (job.started) this.failed(job, error);
    this.reject(job, error);
    if (!job.started) this.remove(job);
    this.pump();
  }

  private failed(job: Job, error: unknown): void {
    if (!transient(error)) return;
    const host = job.host;

    host.failures++;

    if (host.failures >= 2 && host.retryAt <= Date.now()) {
      host.retryAt = Date.now() + host.backoff;
      host.backoff = Math.min(30_000, host.backoff * 2);
    }
  }

  private reject(job: Job, error: unknown): void {
    job.error = error instanceof Error ? error : new Error(String(error));
    Object.assign(job.error, { url: job.url });
    window.clearTimeout(job.timer);
    for (const consumer of job.consumers) { consumer.release(); consumer.reject(job.error); }
    job.consumers.clear();
  }

  private remove(job: Job): void {
    window.clearTimeout(job.timer);
    if (this.jobs.get(job.key) === job) this.jobs.delete(job.key);
    const index = this.queued.indexOf(job);

    if (index >= 0) this.queued.splice(index, 1);
  }
}
