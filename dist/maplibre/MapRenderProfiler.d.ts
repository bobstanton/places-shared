import type { PerformanceMonitor } from "../utils/index";
interface ProfileMap {
    on(event: 'render' | 'idle' | 'remove', listener: () => void): unknown;
    off(event: 'render' | 'idle' | 'remove', listener: () => void): unknown;
}
interface TrackProfileMap extends ProfileMap {
    getSource(id: string): unknown;
    getLayer(id: string): unknown;
    isSourceLoaded(id: string): boolean;
    isMoving(): boolean;
    queryRenderedFeatures(options: {
        layers: string[];
    }): Array<{
        source: string;
    }>;
}
export interface SubmittedTrackSource {
    sourceId: string;
    layerIds: string[];
}
type Phase = 'initial' | 'update';
export declare class MapRenderProfiler {
    private pending;
    private pendingTracks;
    cancelTracks(map: ProfileMap): void;
    startTracks(map: TrackProfileMap, perf: PerformanceMonitor, sources: SubmittedTrackSource[], started: number): void;
    start(map: ProfileMap, perf: PerformanceMonitor, phase: Phase, details: () => Record<string, unknown>, log: (message: string, details: Record<string, unknown>) => void): void;
}
export {};
