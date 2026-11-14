export interface MapCameraGuard {
  beginProgrammaticMove(): () => void;
  isProgrammaticMove(): boolean;
}

export interface MapCameraGuardOptions {
  staleReleaseMs?: number;
  setTimeout?: (fn: () => void, ms: number) => unknown;
  clearTimeout?: (id: unknown) => void;
}

export function createMapCameraGuard(options?: MapCameraGuardOptions): MapCameraGuard {
  const staleReleaseMs = options?.staleReleaseMs ?? 2000;
  const schedule: (fn: () => void, ms: number) => unknown = options?.setTimeout ?? ((fn, ms) => window.setTimeout(fn, ms));
  const cancel: (id: unknown) => void = options?.clearTimeout ?? (id => window.clearTimeout(id as number));
  let depth = 0;

  return {
    beginProgrammaticMove: () => {
      depth++;
      let released = false;
      const release = () => {
        if (released) return;
        released = true;
        cancel(staleTimer);
        depth = Math.max(0, depth - 1);
      };
      const staleTimer = schedule(release, staleReleaseMs);

      return release;
    },
    isProgrammaticMove: () => depth > 0,
  };
}
