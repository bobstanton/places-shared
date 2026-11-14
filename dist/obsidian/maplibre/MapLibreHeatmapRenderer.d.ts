import type { App } from 'obsidian';
import type * as maplibregl from 'maplibre-gl';
import type * as GeoJSON from 'geojson';
import { PlacesBoundingBox } from "../../geo/index";
import type { MapPlace } from "../../overlay/index";
export interface MapLibreHeatmapData {
    type: 'geojson';
    data: GeoJSON.FeatureCollection;
    isHeatmapLayer: true;
    colorScheme: string;
    minWeight: number;
    maxWeight: number;
}
export declare function createHeatmapGeoJson(places: MapPlace[], colorScheme?: string): [MapLibreHeatmapData, PlacesBoundingBox];
export declare function renderHeatmap(options: {
    app: App;
    map: maplibregl.Map;
    data: MapLibreHeatmapData;
}): void;
