import type { FeatureCollection, Geometry } from "geojson";
import { MapPlace } from "../Place";
import { PlacesBoundingBox } from "./PlacesBoundingBox";
export interface GeoJSONConversionResult {
    featureCollection: FeatureCollection<Geometry, Record<string, unknown>>;
    boundingBox: PlacesBoundingBox;
}
export interface ConvertPlacesOptions {
    includeMapPlace?: boolean;
}
export declare function convertPlacesToFeatureCollection(places: MapPlace[], options?: ConvertPlacesOptions): GeoJSONConversionResult;
export declare function convertPlacesToGeoJSONData(places: MapPlace[], options?: ConvertPlacesOptions): [Record<string, unknown>, PlacesBoundingBox];
export declare function convertPointsToFeatureCollection(points: Array<[number, number]>): FeatureCollection;
