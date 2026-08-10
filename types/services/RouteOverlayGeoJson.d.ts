import type * as GeoJSON from 'geojson';
import type { DirectionsOverlayRequest, IsochroneOverlayStyle, RouteMetricLabels, RouteWaypoint } from './IRouteOverlayService';
export declare const DEFAULT_ROUTE_LEG_LABEL_TEMPLATE = "{this.from_name} \u2192 {this.to_name}: {this.distance_text} \u00B7 {this.duration_text}";
export interface RouteLegMetricInput {
    distanceMeters: number;
    durationSeconds: number;
}
export interface RouteLegMetric {
    index: number;
    from_index: number;
    to_index: number;
    from_name: string;
    to_name: string;
    distance_meters: number;
    distance_text: string;
    duration_seconds: number;
    duration_text: string;
}
export declare function formatRouteDuration(seconds: number): string;
export declare function formatRouteDistance(meters: number): string;
export declare function formatRouteWaypointName(point: {
    latitude: number;
    longitude: number;
    name?: string;
}): string;
export declare function formatRouteWaypointCoordinate(point: {
    latitude: number;
    longitude: number;
}): number[];
export declare function buildRouteWaypointProperties(route: RouteWaypoint[]): {
    waypoints: string[];
    waypoint_coordinates: number[][];
    waypoint_paths: Array<string | null>;
    waypoint_icons: Array<string | null>;
};
export declare function buildRouteLegMetrics(route: RouteWaypoint[], legs: RouteLegMetricInput[]): RouteLegMetric[];
export declare function buildRouteLegProperties(legs: RouteLegMetric[]): {
    leg_count: number;
    route_legs: RouteLegMetric[];
    route_legs_json: string;
};
export interface RouteFeatureInput {
    request: DirectionsOverlayRequest;
    provider: string;
    routeIndex: number;
    route: RouteWaypoint[];
    geometry: GeoJSON.Geometry;
    optimized: boolean;
    distanceMeters: number;
    durationSeconds: number;
    legs: RouteLegMetric[];
}
export declare function buildDirectionsRouteFeature(input: RouteFeatureInput): GeoJSON.Feature;
export declare function appendDirectionsRouteFeatures(features: GeoJSON.Feature[], routeFeature: GeoJSON.Feature, request: DirectionsOverlayRequest): Promise<void>;
export declare const GENERATED_OVERLAY_PROPERTY = "places_generated_overlay";
export declare function markGeneratedOverlayFeatures(collection: GeoJSON.FeatureCollection): GeoJSON.FeatureCollection;
export declare function formatIsochroneFeatureName(baseName: string | undefined, mode: string, rangeText: string): string;
export declare const DEFAULT_ISOCHRONE_COLORS: string[];
export declare function getIsochroneStyleColor(index: number, style?: IsochroneOverlayStyle): string;
export declare function getIsochroneStyleColors(count: number, style?: IsochroneOverlayStyle): string[];
export declare function decorateIsochroneFeatureProperties(baseProperties: GeoJSON.GeoJsonProperties, color: string, style?: IsochroneOverlayStyle): GeoJSON.GeoJsonProperties;
export interface PathLabelStrings {
    start?: string;
    mid?: string;
    end?: string;
}
export declare const ROUTE_LABEL_ROLE_PROPERTY = "route_label_role";
export declare function buildPathLabelFeatures(geojson: GeoJSON.FeatureCollection, labels: PathLabelStrings): GeoJSON.Feature[];
export declare function getPathLabelSegments(geojson: GeoJSON.FeatureCollection): GeoJSON.Position[][];
export declare function buildSegmentedPathLabelFeatures(segments: readonly GeoJSON.Position[][], labelsPerSegment: readonly PathLabelStrings[]): GeoJSON.Feature[];
export declare function addRouteLabelFeature(features: GeoJSON.Feature[], routeFeature: GeoJSON.Feature, label: string): void;
export declare function addRouteMetricLabelFeatures(features: GeoJSON.Feature[], routeFeature: GeoJSON.Feature, metricLabels: RouteMetricLabels | undefined, totalTemplate?: string, legTemplate?: string): Promise<void>;
export declare function addRouteLegLabelFeatures(features: GeoJSON.Feature[], routeFeature: GeoJSON.Feature, template?: string): Promise<void>;
export declare function addRouteEndpointFeatures(features: GeoJSON.Feature[], routeFeature: GeoJSON.Feature, waypointLabelTemplate?: string): Promise<void>;
export declare function resolveRouteLabel(properties: GeoJSON.GeoJsonProperties, template?: string): Promise<string>;
export declare function normalizeRouteLabel(properties: GeoJSON.GeoJsonProperties, label?: string): string;
export interface RouteWaypointContext {
    name: string;
    index: number;
    role: 'start' | 'stop' | 'end';
    role_label: string;
    icon: string;
    path: string;
}
