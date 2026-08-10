import { MapPlace } from "../Place";
import { PlacesBoundingBox } from "../geo/PlacesBoundingBox";
import type { MapCameraIntent, MapRenderPlan, MapRenderPlanDiff } from "../render/MapRenderPlan";
import type { MapRenderRequest } from "../settings/MapConfiguration";
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
export interface MapControlHandle {
    getBounds?: () => PlacesBoundingBox;
    centerOnPlace?: (place: MapPlace) => void;
    highlightPlace?: (place: MapPlace) => void;
    clearHighlight?: () => void;
    setGeocodingSearchMarkers?: (places: MapPlace[]) => void;
}
