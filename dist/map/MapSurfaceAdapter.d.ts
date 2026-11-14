import type { MapSourceContext } from '../settings/index';
import type { MapCameraGuard } from './MapCameraGuard';
export interface MapSurfaceEngine {
    on(event: 'movestart' | 'zoomstart' | 'rotatestart' | 'moveend' | 'zoom' | 'zoomend', handler: () => void): void;
    getCenter(): {
        lat: number;
        lng: number;
    };
    getZoom(): number;
    resize(): void;
}
export interface MapSurfacePlumbingOptions {
    container: HTMLElement;
    engine: MapSurfaceEngine;
    source: MapSourceContext;
    guard: MapCameraGuard;
    measure?: <T>(event: string, work: () => T, details?: Record<string, unknown>, options?: {
        slowOnly?: boolean;
    }) => T;
}
export declare function withGuardedCamera(guard: MapCameraGuard, move: () => void): void;
export declare function persistMapViewport(engine: Pick<MapSurfaceEngine, 'getCenter' | 'getZoom'>, source: MapSourceContext): void;
export declare function attachMapSurfacePlumbing(options: MapSurfacePlumbingOptions): () => void;
