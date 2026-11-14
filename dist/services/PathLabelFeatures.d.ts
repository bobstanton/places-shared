import type * as GeoJSON from 'geojson';
export interface PathLabelStrings {
    start?: string;
    mid?: string;
    end?: string;
}
export declare const ROUTE_LABEL_ROLE_PROPERTY = "route_label_role";
export declare function buildPathLabelFeatures(geojson: GeoJSON.FeatureCollection, labels: PathLabelStrings): GeoJSON.Feature[];
export declare function getPathLabelSegments(geojson: GeoJSON.FeatureCollection): GeoJSON.Position[][];
export declare function buildSegmentedPathLabelFeatures(segments: readonly GeoJSON.Position[][], labelsPerSegment: readonly PathLabelStrings[]): GeoJSON.Feature[];
export declare function getMidCoordinate(coordinates: GeoJSON.Position[]): GeoJSON.Position | null;
export declare function getLineDistance(coordinates: GeoJSON.Position[]): number;
export declare function getCoordinateAtDistance(coordinates: GeoJSON.Position[], targetDistance: number): GeoJSON.Position | null;
export declare function approximateCoordinateDistance(start: GeoJSON.Position, end: GeoJSON.Position): number;
export declare function interpolateCoordinate(start: GeoJSON.Position, end: GeoJSON.Position, ratio: number): GeoJSON.Position;
