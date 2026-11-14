import { type UnitsSystem } from "../Units";
import type * as GeoJSON from "geojson";
import { PlaceAction, MapPlace } from "../Place";
import type { ResolvedPopupField } from './PopupContent';
export interface PopupOptions {
    icon?: string;
    name: string;
    isLink: boolean;
    linkPath?: string;
    subtitle?: string;
    actions?: Array<{
        text: string;
        onClick: () => void;
        icon?: string;
        keepOpen?: boolean;
    }>;
    placeActions?: PlaceAction[];
    onPlaceAction?: (actionId: string, state: {
        checked?: boolean;
    }) => void;
    closePopup?: () => void;
    onLinkClick?: (linkPath: string) => void;
    debug?: PopupDebugInfo;
}
export interface PopupDebugInfo {
    fields: Array<{
        field: string;
        value: string;
    }>;
    filterRules: Array<{
        rule: string;
        valid: boolean;
        matched: boolean;
    }>;
}
export declare const PopupClasses: {
    readonly container: "places-popup-content";
    readonly header: "places-popup-header";
    readonly icon: "places-popup-icon";
    readonly name: "places-popup-name";
    readonly subtitle: "places-popup-subtitle";
    readonly actions: "places-popup-actions";
    readonly actionItem: "places-context-menu-item";
    readonly actionIcon: "places-context-menu-icon";
};
export declare function setDevicePathsOpenable(openable: boolean): void;
export declare function isOpenableLink(linkTarget: string): boolean;
export declare function popupLinkClass(linkTarget: string): string;
export interface PopupWheelGuardTarget {
    on(type: 'open', listener: () => void): unknown;
    getElement(): HTMLElement | undefined;
}
export declare function attachPopupWheelGuard(popup: PopupWheelGuardTarget): void;
export interface PopupActionRow {
    label: string;
    icon?: string;
    checked?: boolean;
    keepOpen?: boolean;
    onSelect: (state: {
        checked?: boolean;
    }) => void;
}
export declare function appendPlaceSection(container: HTMLElement, options: PopupOptions): void;
export declare function buildMultiPlacePopupContent(options: {
    title: string;
    places: PopupOptions[];
}): HTMLElement;
export interface PopupPageEntry {
    readonly label: string;
    readonly icon?: string;
    readonly kind: string;
}
export interface PagedPopupOptions {
    readonly pages: readonly PopupPageEntry[];
    readonly onShow: (index: number, host: HTMLElement, root: HTMLElement) => void | (() => void);
}
export interface PagedPopup {
    readonly element: HTMLElement;
    readonly index: number;
    show(index: number): void;
    dispose(): void;
}
export declare function buildPagedPopupContent(options: PagedPopupOptions): PagedPopup;
export declare function buildPopupContent(options: PopupOptions): HTMLElement;
export declare function appendPopupDebugSection(container: HTMLElement, debug: PopupDebugInfo): void;
export declare function buildGeocodingSearchPopupContent(place: MapPlace, onPlaceAction?: (place: MapPlace, actionId: string, state: {
    checked?: boolean;
}) => void, closePopup?: () => void): HTMLElement;
export declare function appendGeoJsonProperties(container: HTMLElement, properties: GeoJSON.GeoJsonProperties, excludeKeys: Set<string>): void;
export declare function appendPopupFields(container: HTMLElement, fields: readonly ResolvedPopupField[]): void;
export declare function getGeoJsonGeometryIcon(geometryType: string): string;
export interface GeoJsonFeaturePopupContentOptions {
    properties: GeoJSON.GeoJsonProperties;
    geometryType: string;
    sourcePath?: string;
    onSourceLinkClick?: (linkPath: string) => void;
    excludeKeys?: Set<string>;
    includeProperties?: boolean;
}
export declare function buildGeoJsonFeaturePopupContent(options: GeoJsonFeaturePopupContentOptions): HTMLElement;
export interface OverlayPointPopupContentOptions {
    properties: GeoJSON.GeoJsonProperties;
    sourcePath?: string;
    defaultName?: string;
    onSourceLinkClick?: (linkPath: string) => void;
    includeProperties?: boolean;
}
export declare function createSourceLinkClickHandler(sourcePath: string | undefined, openInternalLink: (linkPath: string) => void): ((linkPath: string) => void) | undefined;
export declare function resolveOverlayPointName(properties: GeoJSON.GeoJsonProperties, sourcePath?: string, defaultName?: string): string;
export declare function resolveOverlayPointIcon(properties: GeoJSON.GeoJsonProperties): string;
export declare function buildOverlayPointPopupContent(options: OverlayPointPopupContentOptions): HTMLElement;
export declare function appendDefaultGeoJsonProperties(container: HTMLElement, properties: GeoJSON.GeoJsonProperties, presentation: 'feature' | 'point', excludeKeys?: Set<string>): void;
export interface WaypointPopupOptions {
    readonly place: MapPlace;
    readonly units: UnitsSystem;
    readonly onSourceLinkClick?: (linkPath: string) => void;
}
export declare function buildWaypointPopupContent(options: WaypointPopupOptions): HTMLElement;
