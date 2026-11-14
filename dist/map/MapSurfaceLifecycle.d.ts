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
export declare function ensureMapSurfaceLifecycle(container: HTMLElement): MapSurfaceLifecycle;
export declare function getMapSurfaceLifecycle(container: HTMLElement): MapSurfaceLifecycle | undefined;
export declare function clearMapSurfaceLifecycle(container: HTMLElement): void;
