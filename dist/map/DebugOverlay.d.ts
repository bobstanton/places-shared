import { MapPlace } from '../Place';
import type { MapPrepareTimings } from '../settings/MapConfiguration';
export interface DebugTilesetSummary {
    url: string;
    layers: Array<{
        id: string;
        fields: Record<string, string>;
    }>;
}
export interface DebugOverlayInput {
    places: MapPlace[];
    overlayCount?: number;
    geoJsonOverlayCount?: number;
    imageOverlayCount: number;
    vectorTileOverlayCount?: number;
    providerName: string;
    style?: string;
    loadStartTime: number;
    prepareTimings?: MapPrepareTimings;
    tilesets?: DebugTilesetSummary[];
}
export type DebugOverlayDataUpdate = Pick<DebugOverlayInput, 'places' | 'overlayCount' | 'geoJsonOverlayCount' | 'imageOverlayCount' | 'vectorTileOverlayCount'>;
export interface DebugData extends DebugOverlayInput {
    overlayCount: number;
    trackCount: number;
    renderStartTime?: number;
    renderEndTime?: number;
    updateData?: (update: DebugOverlayDataUpdate) => void;
}
export interface DebugOverlayBounds {
    south: number;
    west: number;
    north: number;
    east: number;
}
export interface DebugOverlayMapState {
    zoom: number;
    minZoom?: number;
    maxZoom?: number;
    center: {
        lat: number;
        lng: number;
    };
    bounds?: DebugOverlayBounds;
}
export interface DebugFeatureSummary {
    layer?: string;
    sourceLayer?: string;
    geometryType?: string;
    properties?: Record<string, unknown> | null;
    coordinatesSummary?: unknown;
    wouldPassPoiFilter?: boolean;
}
export interface DebugOverlayAdapter {
    interactive?: boolean;
    getState(): DebugOverlayMapState;
    onStateChange(handler: () => void): void;
    onMouseMove(handler: (lat: number, lng: number) => void): void;
    onMouseOut(handler: () => void): void;
    onClickFeatures?(handler: (features: DebugFeatureSummary[]) => void): void;
}
export declare function createVectorDebugOverlayAdapter(mapSource: unknown, options?: {
    includeClickFeatures?: boolean;
}): DebugOverlayAdapter;
export declare function createLeafletDebugOverlayAdapter(mapSource: unknown): DebugOverlayAdapter;
export declare function addSharedDebugOverlay(container: HTMLElement, input: DebugOverlayInput, adapter: DebugOverlayAdapter): DebugData;
export declare function createDebugFeatureSummary(feature: {
    layer?: {
        id?: string;
    };
    sourceLayer?: string;
    properties?: Record<string, unknown> | null;
    geometry?: {
        type?: string;
        coordinates?: unknown;
    };
}): DebugFeatureSummary;
