import type * as GeoJSON from 'geojson';
import type * as maplibregl from 'maplibre-gl';
import { type PlaceNoteHost } from "../../map/index";
export interface POIDiscoveryInfo {
    name: string;
    class: string;
    subclass: string;
    coordinates: maplibregl.LngLat;
    layer: string;
    sourceLayer: string;
    geometry?: GeoJSON.Geometry;
}
export declare class POIDiscoveryHandler {
    setup(map: maplibregl.Map, poiFilterPatterns: string[], placeNoteHost?: PlaceNoteHost, getSourcePath?: () => string | undefined): void;
    private discoverAt;
    private showPopup;
}
