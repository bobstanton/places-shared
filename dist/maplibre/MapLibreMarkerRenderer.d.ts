import type * as maplibregl from 'maplibre-gl';
import type * as GeoJSON from 'geojson';
import type { MapPlace } from "../overlay/index";
export declare function createPointFeature(options: {
    place: MapPlace;
    zoomSizeStops?: number[];
    iconImageId: string;
    glyphImageId?: string;
    mapAlignedIcons?: boolean;
}): GeoJSON.Feature;
export declare function createHtmlMarkerFeature(options: {
    place: MapPlace;
    iconImageId: string;
}): GeoJSON.Feature;
export declare function updateTextLabelSource(map: maplibregl.Map, places: MapPlace[]): void;
