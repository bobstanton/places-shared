import { App, Component } from "obsidian";
import { MapPlace } from "../Place";
export declare const POPUP_DISABLE_MAPS_ATTRIBUTE = "data-places-disable-maps";
export interface RenderedPopupContent {
    component: Component;
    dispose(): void;
}
export declare function mapsAreDisabledForRender(element: HTMLElement): boolean;
export declare function renderSuppressedMapPlaceholder(element: HTMLElement): void;
export declare function renderPopupContentCore(app: App, place: MapPlace, containerElement: HTMLElement): Promise<RenderedPopupContent | null>;
export declare function renderPopupContent(app: App, place: MapPlace, containerElement: HTMLElement): Promise<RenderedPopupContent | null>;
export declare function renderPopupContentAsync(app: App, place: MapPlace, containerElement: HTMLElement): void;
