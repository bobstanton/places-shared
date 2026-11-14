import type * as GeoJSON from 'geojson';
export type PointGeometry = GeoJSON.Point;
export type MultiPointGeometry = GeoJSON.MultiPoint;
export type LineStringGeometry = GeoJSON.LineString;
export type MultiLineStringGeometry = GeoJSON.MultiLineString;
export type PolygonGeometry = GeoJSON.Polygon;
export type MultiPolygonGeometry = GeoJSON.MultiPolygon;
export type GeometryCollection = GeoJSON.GeometryCollection;
export type GeoJsonPosition = GeoJSON.Position;
export interface GeoJsonGeometryParts {
    points: GeoJsonPosition[];
    lines: GeoJsonPosition[][];
}
export declare function isGeoJsonGeometry(value: unknown): value is GeoJSON.Geometry;
export declare function isGeoJsonFeature(value: unknown): value is GeoJSON.Feature;
export declare function isGeoJsonFeatureCollection(value: unknown): value is GeoJSON.FeatureCollection;
export declare function isGeoJson(value: unknown): value is GeoJSON.GeoJSON;
export declare function extractFirstGeoJsonCoordinateFromGeoJson(geojson: GeoJSON.GeoJSON): GeoJsonPosition | null;
export declare function extractFirstGeoJsonCoordinate(geometry: GeoJSON.Geometry | null | undefined): GeoJsonPosition | null;
export declare function collectGeoJsonGeometryParts(geometry: GeoJSON.Geometry | null | undefined): GeoJsonGeometryParts;
export declare function forEachGeoJsonPosition(geometry: GeoJSON.Geometry | null | undefined, visitor: (position: GeoJsonPosition) => void): void;
