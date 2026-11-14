import type { MapPlace } from '../../place/index';
export interface RemovableMapMarker {
    remove: () => void;
}
export declare function getStoredSearchResultMarkers<TMarker extends RemovableMapMarker>(container: HTMLElement): TMarker[];
export declare function setStoredSearchResultMarkers<TMarker extends RemovableMapMarker>(container: HTMLElement, markers: TMarker[]): void;
export declare function createSearchResultMarkerElement(place: MapPlace): HTMLElement;
export interface SetSearchResultMarkersOptions<TMarker extends RemovableMapMarker> {
    container: HTMLElement;
    places: MapPlace[];
    createMarker: (place: MapPlace, element: HTMLElement) => TMarker;
    onMarkerClick: (place: MapPlace) => void;
    focus: {
        enter(): void;
        clear(): void;
    };
}
export declare function setSearchResultMarkers<TMarker extends RemovableMapMarker>(options: SetSearchResultMarkersOptions<TMarker>): void;
