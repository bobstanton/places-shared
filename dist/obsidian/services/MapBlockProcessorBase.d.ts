import type { App } from 'obsidian';
import { MapPlace } from "../../place/index";
import type { PerformanceMonitor } from "../../utils/index";
import { type Coordinate } from "../../geo/index";
import type { MapRenderRequest, ResolvedMapConfig } from "../../settings/index";
import { IMapBlockProcessor, MapControlHandle, MapDataUpdateContext, MapDataUpdateResult, type MapIncrementalUpdateCapabilities } from "../../services/index";
export type { CommonMapSettings } from '../../services/CommonMapSettings';
import type { CommonMapSettings } from '../../services/CommonMapSettings';
export declare abstract class MapBlockProcessorBase implements IMapBlockProcessor {
    protected app?: App;
    protected developerMode: boolean;
    abstract processPlaceCodeBlock(places: MapPlace[], mapContainerElement: HTMLElement, request: MapRenderRequest): void | Promise<void>;
    cleanup(): void;
    updateMapData(_container: HTMLElement, _places: MapPlace[], _request: MapRenderRequest, _context?: MapDataUpdateContext): Promise<MapDataUpdateResult>;
    getIncrementalUpdateCapabilities(): Readonly<MapIncrementalUpdateCapabilities>;
    protected declineUpdate(reason: string, perf?: PerformanceMonitor): MapDataUpdateResult;
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
