import { App } from "obsidian";
import type { MetricWindow } from '../settings/MetricWindow';
import { MapPlace } from "../Place";
import type { TrackColorBy } from "../track/TrackRenderer";
import type { PerformanceMonitor } from "../utils/PerformanceMonitor";
import { type Coordinate } from "../geo/DistanceCalculator";
import type { MapRenderRequest, ResolvedMapConfig } from "../settings/MapConfiguration";
import type { TrackVisibilityResult } from "../track/TrackVisibilityResolver";
import { IMapBlockProcessor, MapControlHandle, MapDataUpdateContext, MapDataUpdateResult, type MapIncrementalUpdateCapabilities } from "./IMapBlockProcessor";
export interface CommonMapSettings {
    trackColorBy?: TrackColorBy;
    trackOutline?: boolean;
    trackGradeWindow: MetricWindow;
    trackSpeedWindow: MetricWindow;
    showLabels: boolean;
    trackDefaultVisibility?: 'visible' | 'hidden';
    poiDiscovery?: boolean;
    onPlaceAction?: (place: MapPlace, actionId: string, state: {
        checked?: boolean;
    }) => void;
    placeNoteHost?: MapRenderRequest['runtime']['placeNoteHost'];
    reverseGeocodeHost?: MapRenderRequest['runtime']['reverseGeocodeHost'];
    inspectTrack?: MapRenderRequest['runtime']['inspectTrack'];
    trackDetails: ResolvedMapConfig['trackDetails'];
    trackVisibility: TrackVisibilityResult;
    popupDebug?: MapRenderRequest['runtime']['popupDebug'];
}
export declare abstract class MapBlockProcessorBase implements IMapBlockProcessor {
    protected app?: App;
    protected developerMode: boolean;
    abstract processPlaceCodeBlock(places: MapPlace[], mapContainerElement: HTMLElement, request: MapRenderRequest): void | Promise<void>;
    cleanup(): void;
    updateMapData(_container: HTMLElement, _places: MapPlace[], _request: MapRenderRequest, _context?: MapDataUpdateContext): Promise<MapDataUpdateResult>;
    getIncrementalUpdateCapabilities(): Readonly<MapIncrementalUpdateCapabilities>;
    protected getMapDataUpdateIneligibleReason(blockSettings: ResolvedMapConfig): string | null;
    getCurrentPlaces(_container: HTMLElement): MapPlace[] | null;
    getMapControlHandle(_container: HTMLElement): MapControlHandle | null;
    protected createFrequencyPopup(frequency: number, contributingFiles: string[]): HTMLElement;
    protected measureIf<T>(perf: PerformanceMonitor | undefined, event: string, work: () => T, details?: Record<string, unknown>, options?: {
        slowOnly?: boolean;
        thresholdMs?: number;
    }): T;
    protected getMinZoom(blockSettings: ResolvedMapConfig): number;
    protected extractCommonSettings(blockSettings: ResolvedMapConfig, runtime: MapRenderRequest['runtime']): CommonMapSettings;
    protected processOverlays(_map: unknown, _mapContainer: HTMLElement, _request: MapRenderRequest, _places: MapPlace[]): Promise<void>;
    protected getOverlayLocation(places: MapPlace[]): Coordinate | null;
    protected showOverlayError(container: HTMLElement, message: string): void;
}
