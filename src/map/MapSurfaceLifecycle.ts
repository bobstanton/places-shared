export type MapSurfaceLifecyclePhase = 'idle' | 'created' | 'loaded';

export interface MapSurfaceLifecycleState {
  phase: MapSurfaceLifecyclePhase;
  sized: boolean;
  width: number;
  height: number;
  userCameraInteracted: boolean;
}

export type MapSurfaceLifecycleEvent = 'created' | 'loaded' | 'sized' | 'resized' | 'zero-sized' | 'user-camera' | 'destroyed';

export type MapSurfaceLifecycleListener = (state: Readonly<MapSurfaceLifecycleState>, event: MapSurfaceLifecycleEvent) => void;

export interface MapSurfaceLifecycle {
  getState(): Readonly<MapSurfaceLifecycleState>;
  subscribe(listener: MapSurfaceLifecycleListener): () => void;
  reportCreated(): void;
  reportLoaded(): void;
  reportSize(width: number, height: number): void;
  reportUserCameraGesture(): void;
  reportDestroyed(): void;
}

const LIFECYCLE_PROP = '_placesMapLifecycle';

function createMapSurfaceLifecycle(): MapSurfaceLifecycle {
  const state: MapSurfaceLifecycleState = {
    phase: 'idle',
    sized: false,
    width: 0,
    height: 0,
    userCameraInteracted: false,
  };
  const listeners = new Set<MapSurfaceLifecycleListener>();

  const emit = (event: MapSurfaceLifecycleEvent) => {
    for (const listener of [...listeners]) {
      listener(state, event);
    }
  };

  return {
    getState: () => state,
    subscribe: (listener: MapSurfaceLifecycleListener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    reportCreated: () => {
      if (state.phase !== 'idle') return;
      state.phase = 'created';
      emit('created');
    },
    reportLoaded: () => {
      if (state.phase === 'loaded') return;
      state.phase = 'loaded';
      emit('loaded');
    },
    reportSize: (width: number, height: number) => {
      const sized = width > 0 && height > 0;
      const wasSized = state.sized;
      if (sized === wasSized && width === state.width && height === state.height) return;
      state.width = width;
      state.height = height;
      state.sized = sized;
      emit(sized ? (wasSized ? 'resized' : 'sized') : 'zero-sized');
    },
    reportUserCameraGesture: () => {
      if (state.userCameraInteracted) return;
      state.userCameraInteracted = true;
      emit('user-camera');
    },
    reportDestroyed: () => {
      if (state.phase === 'idle' && !state.sized && !state.userCameraInteracted) return;
      state.phase = 'idle';
      state.sized = false;
      state.width = 0;
      state.height = 0;
      state.userCameraInteracted = false;
      emit('destroyed');
    },
  };
}

export function ensureMapSurfaceLifecycle(container: HTMLElement): MapSurfaceLifecycle {
  const holder = container as HTMLElement & { [LIFECYCLE_PROP]?: MapSurfaceLifecycle };
  if (!holder[LIFECYCLE_PROP]) {
    holder[LIFECYCLE_PROP] = createMapSurfaceLifecycle();
  }
  return holder[LIFECYCLE_PROP];
}

export function getMapSurfaceLifecycle(container: HTMLElement): MapSurfaceLifecycle | undefined {
  return (container as HTMLElement & { [LIFECYCLE_PROP]?: MapSurfaceLifecycle })[LIFECYCLE_PROP];
}

export function clearMapSurfaceLifecycle(container: HTMLElement): void {
  delete (container as HTMLElement & { [LIFECYCLE_PROP]?: MapSurfaceLifecycle })[LIFECYCLE_PROP];
}
