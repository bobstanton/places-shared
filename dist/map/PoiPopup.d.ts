import type * as GeoJSON from 'geojson';
import type { PoiPlaceNoteRequest } from './PlaceNoteRequest';
export interface DiscoveredPoi {
    name: string;
    class: string;
    subclass?: string;
    lat: number;
    lng: number;
    layer?: string;
    sourceLayer?: string;
    geometry?: GeoJSON.Geometry;
}
export declare function poiPlaceNoteRequest(poi: DiscoveredPoi, geometry?: GeoJSON.Geometry): PoiPlaceNoteRequest;
export interface PoiPopupOptions {
    poi: DiscoveredPoi;
    icon?: string;
    createNoteText?: string;
    copyTextPrefix?: string;
    closePopup: () => void;
    onCreateNote?: () => void;
    onCopy: (text: string, message: string) => void;
}
export declare function buildPoiPopupContent(options: PoiPopupOptions): HTMLElement;
