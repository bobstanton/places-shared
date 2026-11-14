import type * as GeoJSON from 'geojson';
export interface GeoJsonFootprint {
    features: number;
    vertices: number;
    estimatedBytes: number;
}
export declare function geoJsonFootprint(value: GeoJSON.GeoJSON): GeoJsonFootprint;
