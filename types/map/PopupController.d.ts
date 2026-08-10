import type { App } from "obsidian";
import type * as GeoJSON from "geojson";
import type { MapPlace } from "../Place";
import type { PlaceNoteHost } from "./PlaceNoteRequest";
import { queryPoiGeometry } from "./VectorFeatureHelpers";
export interface PopupLike<TMap, TCoordinates> {
    setLngLat(coordinates: TCoordinates): this;
    setDOMContent(content: Node): this;
    addTo(map: TMap): this;
    remove(): void;
    getElement(): HTMLElement | null | undefined;
    on?(type: 'close', listener: () => void): unknown;
}
export interface CreatePlacePopupOptions<TMap, TCoordinates, TPopup extends PopupLike<TMap, TCoordinates>> {
    app: App;
    map: TMap;
    place: MapPlace;
    coordinates: TCoordinates;
    popupSelector: string;
    createPopup: () => TPopup;
    onPlaceAction?: (place: MapPlace, actionId: string, state: {
        checked?: boolean;
    }) => void;
}
export interface CreatePlaceSummaryPopupOptions<TMap, TCoordinates, TPopup extends PopupLike<TMap, TCoordinates>> {
    onPlaceAction?: (place: MapPlace, actionId: string, state: {
        checked?: boolean;
    }) => void;
    app: App;
    map: TMap;
    place: MapPlace;
    coordinates: TCoordinates;
    popupSelector: string;
    createPopup: () => TPopup;
}
export interface CreateContentPopupOptions<TMap, TCoordinates, TPopup extends PopupLike<TMap, TCoordinates>> {
    map: TMap;
    coordinates: TCoordinates;
    content: Node;
    popupSelector: string;
    createPopup: () => TPopup;
}
export interface CreateOverlayPointPopupOptions<TMap, TPopup extends PopupLike<TMap, [number, number]>> {
    app: App;
    map: TMap;
    feature: GeoJSON.Feature;
    popupSelector?: string;
    createPopup: () => TPopup;
}
export interface PoiDiscoveryPopupInfo {
    name: string;
    class: string;
    subclass: string;
    coordinates: {
        lat: number;
        lng: number;
    };
    layer: string;
}
export interface BuildPoiDiscoveryPopupContentOptions<TMap> {
    map: TMap;
    poi: PoiDiscoveryPopupInfo;
    placeNoteHost?: PlaceNoteHost;
    createNoteText?: string;
    copyTextPrefix?: string;
    popupSelector?: string;
    closePopups?: () => void;
    geometryQuery?: Pick<Parameters<typeof queryPoiGeometry>[0], 'nameProperties' | 'queryLayerDirectly'>;
}
export interface StandardPlacePopupOptions {
    [key: string]: unknown;
    offset: number | [number, number];
    className: string;
    closeOnClick: boolean;
    closeOnMove: boolean;
    focusAfterOpen: boolean;
}
export declare function createStandardPlacePopupOptions(overrides?: Partial<StandardPlacePopupOptions>): StandardPlacePopupOptions;
export declare const GL_POPUP_SELECTOR = ".maplibregl-popup, .mapboxgl-popup";
export declare function closeExistingPopups(selector: string): void;
export declare function createPlacePopup<TMap, TCoordinates, TPopup extends PopupLike<TMap, TCoordinates>>(options: CreatePlacePopupOptions<TMap, TCoordinates, TPopup>): Promise<TPopup>;
export declare function createPlaceSummaryPopup<TMap, TCoordinates, TPopup extends PopupLike<TMap, TCoordinates>>(options: CreatePlaceSummaryPopupOptions<TMap, TCoordinates, TPopup>): TPopup;
export declare function createContentPopup<TMap, TCoordinates, TPopup extends PopupLike<TMap, TCoordinates>>(options: CreateContentPopupOptions<TMap, TCoordinates, TPopup>): TPopup;
export declare function createOverlayPointPopup<TMap, TPopup extends PopupLike<TMap, [number, number]>>(options: CreateOverlayPointPopupOptions<TMap, TPopup>): TPopup;
export declare function buildPoiDiscoveryPopupContent<TMap>(options: BuildPoiDiscoveryPopupContentOptions<TMap>): HTMLElement;
