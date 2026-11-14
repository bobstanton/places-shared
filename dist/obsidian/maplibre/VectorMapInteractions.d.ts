import { MapPlace } from "../../overlay/index";
import { MapControlHandle } from "../../services/index";
import type * as maplibregl from "maplibre-gl";
type VectorPaintValue = string | number | boolean | maplibregl.ExpressionSpecification;
export interface VectorFocusMap {
    getLayer?(id: string): unknown;
    setPaintProperty?(layerId: string, property: string, value: VectorPaintValue): void;
    once?(event: 'moveend', listener: () => void): unknown;
}
export interface VectorControlMap {
    getBounds: () => {
        getSouth: () => number;
        getWest: () => number;
        getNorth: () => number;
        getEast: () => number;
    } | null | undefined;
    getZoom: () => number;
    jumpTo: (options: {
        center: [number, number];
        zoom: number;
    }) => unknown;
}
export interface MissingSpriteImageMap {
    addImage: (id: string, image: ImageData) => unknown;
}
export declare const SYMBOL_MARKER_LAYER_ID = "places-symbol-markers";
export declare const SYMBOL_BENEATH_LAYER_ID = "places-symbol-markers-beneath";
export declare const SYMBOL_MARKER_LAYER_IDS: readonly string[];
export declare const SYMBOL_ICON_BASE_OPACITY: maplibregl.ExpressionSpecification;
export declare const VECTOR_FOCUS_DIM_OPACITY = 0.2;
export declare function restoreVectorLabelOpacity(map: VectorFocusMap | undefined): void;
export declare function dimVectorLabels(map: VectorFocusMap | undefined, focusedPlaceId?: string): void;
export declare function focusMapMarkerElement(container: HTMLElement, place: MapPlace, map?: VectorFocusMap): void;
export declare function enterVectorFocusMode(container: HTMLElement, map?: VectorFocusMap, focusedPlaceId?: string): void;
export declare function clearVectorFocusMode(container: HTMLElement, map?: VectorFocusMap): void;
export declare function addTransparentMissingSpriteImage(map: MissingSpriteImageMap, id: string): void;
export declare function shouldSkipPlacePopup(place: MapPlace): boolean;
export interface CreateVectorMapControlHandleOptions<TMap extends VectorControlMap> {
    container: HTMLElement;
    map: TMap;
    highlightPlace: (place: MapPlace) => void;
    clearHighlight: () => void;
    setGeocodingSearchMarkers: (places: MapPlace[]) => void;
}
export declare function createVectorMapControlHandle<TMap extends VectorControlMap>(options: CreateVectorMapControlHandleOptions<TMap>): MapControlHandle;
export {};
