import { Coordinate } from '../geo/DistanceCalculator';
import type { RouteTravelMode } from './IRouteOverlayService';
import type { UnitsSystem } from '../Units';
export interface SnapPoint extends Coordinate {
    time?: Date;
}
export type SnapShapeMatch = 'map_snap' | 'edge_walk' | 'walk_or_snap';
export type SnapExclusion = 'motorway' | 'toll' | 'ferry';
export interface SnapRequest {
    points: SnapPoint[];
    mode: RouteTravelMode;
    costing?: string;
    costingOptions?: Record<string, unknown>;
    radiusMeters?: number;
    timestamps?: boolean;
    tidy?: boolean;
    exclude?: SnapExclusion[];
    shapeMatch?: SnapShapeMatch;
    traceOptions?: Record<string, unknown>;
    units?: UnitsSystem;
    attributes?: string[];
}
export interface SnappedPoint {
    latitude: number;
    longitude: number;
    snapped: boolean;
    edgeIndex?: number;
}
export interface SnapMatchedEdge {
    names?: string[];
    surface?: string;
    roadClass?: string;
    use?: string;
}
export interface SnapResult {
    points: SnappedPoint[];
    geometry?: Coordinate[];
    edges?: SnapMatchedEdge[];
}
export interface ISnapService {
    getProviderName(): string;
    getMaxPointCount?(): number;
    snapPoints(request: SnapRequest): Promise<SnapResult>;
    describeUnsupportedRequest?(request: SnapRequest): string[];
}
export declare function shouldSendTimestamps(request: SnapRequest): boolean;
export interface SnapOptionSupport {
    costing?: boolean;
    costingOptions?: boolean;
    timestamps?: boolean;
    tidy?: boolean;
    exclude?: boolean;
    shapeMatch?: boolean;
    traceOptions?: boolean;
    attributes?: boolean;
}
export declare function describeUnsupportedSnapOptions(providerDisplayName: string, request: SnapRequest, supported: SnapOptionSupport): string[];
