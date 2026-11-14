export function finishWork<T>(work: Generator<void, T>): T {
  let step = work.next();

  while (!step.done) step = work.next();

  return step.value;
}

export async function runCooperativeWork<T>(work: Generator<void, T>, signal?: AbortSignal): Promise<T> {
  try {
    while (true) {
      signal?.throwIfAborted();
      const started = performance.now();

      do {
        const step = work.next();

        if (step.done) return step.value;
        signal?.throwIfAborted();
      } while (performance.now() - started < 4);

      const scheduler = (globalThis as typeof globalThis & { scheduler?: {
        postTask(callback: () => void, options: { priority: 'background' }): Promise<void>;
      } }).scheduler;

      if (scheduler?.postTask) await scheduler.postTask(() => {}, { priority: 'background' });
      else await new Promise<void>(resolve => setTimeout(resolve, 0));
    }
  } finally {
    work.return(undefined as T);
  }
}

export class CooperativeWorkQueue {
  private jobs: Array<() => void> = [];
  private active = false;

  run<T>(create: () => Generator<void, T>, signal: AbortSignal): Promise<T> {
    if (signal.aborted) return Promise.reject(signal.reason instanceof Error ? signal.reason : new DOMException('Work canceled', 'AbortError'));

    return new Promise<T>((resolve, reject) => {
      let started = false;
      const cancel = () => {
        if (started) return;
        this.jobs = this.jobs.filter(job => job !== start);
        signal.removeEventListener('abort', cancel);
        reject(signal.reason instanceof Error ? signal.reason : new DOMException('Work canceled', 'AbortError'));
      };
      const start = () => {
        started = true;
        signal.removeEventListener('abort', cancel);
        void Promise.resolve().then(() => {
          signal.throwIfAborted();

          return runCooperativeWork(create(), signal);
        }).then(resolve, reject).finally(() => {
          this.active = false;
          this.drain();
        });
      };

      signal.addEventListener('abort', cancel, { once: true });
      this.jobs.push(start);
      this.drain();
    });
  }

  private drain(): void {
    if (this.active) return;
    const next = this.jobs.shift();

    if (!next) return;
    this.active = true;
    next();
  }
}
