import type * as GeoJSON from 'geojson';
import type { Coordinate } from '../geo/DistanceCalculator';
import type { CachePolicy } from '../settings/CachePolicy';
import type { ZoomRange } from '../ZoomVisibility';
export type RouteTravelMode = 'drive' | 'walk' | 'bike';
export type IsochroneRangeType = 'time' | 'distance';
export type RouteMetricLabels = 'total' | 'legs' | 'both' | 'none';
export interface RouteWaypoint extends Coordinate {
    name?: string;
    sourcePath?: string;
    icon?: string;
}
export interface RouteOverlayRequestBase {
    name?: string;
    cache?: CachePolicy;
    provider?: string;
    mode: RouteTravelMode;
    traffic?: boolean;
}
export interface DirectionsOverlayRequest extends RouteOverlayRequestBase {
    routes: RouteWaypoint[][];
    optimize?: boolean;
    metricLabels?: RouteMetricLabels;
    labelTemplate?: string;
    legLabelTemplate?: string;
    waypointLabelTemplate?: string;
    style?: DirectionsOverlayStyle;
}
export interface DirectionsOverlayStyle {
    color?: string;
    strokeWidth?: number;
    strokeOpacity?: number;
}
export interface IsochroneOverlayStyle {
    colors?: string[];
    strokeWidth?: number;
    strokeOpacity?: number;
    fillOpacity?: number;
}
export interface IsochroneOverlayRequest extends RouteOverlayRequestBase {
    rangeType: IsochroneRangeType;
    ranges: number[];
    centers: RouteWaypoint[];
    polygons: boolean;
    zoom?: ZoomRange;
    style?: IsochroneOverlayStyle;
}
export interface RouteOverlayCapabilities {
    supportsIsochrones?: boolean;
    routeOptimization: boolean;
    distanceIsochrones: boolean;
    polygonIsochrones: boolean;
    trafficIsochrones?: boolean;
    trafficDirections?: boolean;
}
export interface RouteOverlayService {
    getProviderName(): string;
    getCapabilities?(): RouteOverlayCapabilities;
    getDirectionsOverlay(request: DirectionsOverlayRequest): Promise<GeoJSON.FeatureCollection>;
    getIsochroneOverlay(request: IsochroneOverlayRequest): Promise<GeoJSON.FeatureCollection>;
}
