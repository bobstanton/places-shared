import type { MapPlace } from '../place/index';
export interface MarkerZoomTestOptions {
    minZoom?: number;
    maxZoom?: number;
    delayMs?: number;
    providerName?: string;
}
export declare function runMarkerZoomTest(container: HTMLElement, places: MapPlace[], zoomToPlace: (place: MapPlace, zoom: number) => void | Promise<void>, getVisiblePlaces: (places: MapPlace[]) => MapPlace[], options?: MarkerZoomTestOptions): Promise<void>;
