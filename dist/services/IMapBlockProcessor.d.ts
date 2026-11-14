import { MapPlace } from "../Place";
import { PlacesBoundingBox } from "../geo/PlacesBoundingBox";
import type { MapCameraIntent, MapRenderPlan, MapRenderPlanDiff } from "../render/MapRenderPlan";
import type { MapRenderRequest } from "../settings/MapConfiguration";
import type { Coordinate } from "../geo/DistanceCalculator";
export type MapCameraApplyResult = {
    applied: true;
} | {
    applied: false;
    reason: string;
};
export type MapDataUpdateResult = {
    updated: true;
} | {
    updated: false;
    status: 'requires-rebuild' | 'temporarily-unavailable';
    reason: string;
};
export interface MapIncrementalUpdateCapabilities {
    places: boolean;
    overlays: boolean;
    styles: boolean;
    tools: boolean;
    clustering: boolean;
    terrain: boolean;
}
export interface MapDataUpdateContext {
    previousPlan?: MapRenderPlan | null;
    nextPlan?: MapRenderPlan | null;
    planDiff?: MapRenderPlanDiff | null;
}
export interface IMapBlockProcessor {
    processPlaceCodeBlock(places: MapPlace[], mapContainerElement: HTMLElement, request: MapRenderRequest): void | Promise<void>;
    cleanup(): void;
    updateMapData(container: HTMLElement, places: MapPlace[], request: MapRenderRequest, context?: MapDataUpdateContext): Promise<MapDataUpdateResult>;
    getIncrementalUpdateCapabilities(): Readonly<MapIncrementalUpdateCapabilities>;
    getCurrentPlaces(container: HTMLElement): MapPlace[] | null;
    getMapControlHandle?(container: HTMLElement): MapControlHandle | null;
    setGeocodingSearchMarkers?(places: MapPlace[], container: HTMLElement): void;
    applyCamera?(container: HTMLElement, camera: MapCameraIntent, request: MapRenderRequest): MapCameraApplyResult;
    readonly supportsLiveMarkerVisibility?: boolean;
    applyMarkerVisibility?(container: HTMLElement, hiddenPlaceIds: readonly string[]): void;
}
export interface MapViewState {
    bounds: PlacesBoundingBox;
    center: Coordinate;
    zoom: number;
    bearing: number;
    pitch: number;
    width: number;
    height: number;
}
export interface MapControlHandle {
    getBounds?: () => PlacesBoundingBox;
    getViewState?: () => MapViewState;
    onBoundsChanged?: (listener: () => void) => () => void;
    centerOnPlace?: (place: MapPlace) => void;
    highlightPlace?: (place: MapPlace) => void;
    clearHighlight?: () => void;
    setGeocodingSearchMarkers?: (places: MapPlace[]) => void;
    setDevicePositionControl?: (button: HTMLButtonElement | null) => void;
}
