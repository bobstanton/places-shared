import type { Coordinate } from '../geo/DistanceCalculator';
import { type SnapMatchedEdge, type SnapRequest, type SnapResult } from './ISnapService';
import type { UnitsSystem } from '../Units';
import type { ValhallaTraceEdge } from './ValhallaTraceMatch';
export declare function normalizeTraceOptions(traceOptions: Record<string, unknown> | undefined, units: UnitsSystem): Record<string, unknown> | undefined;
export declare function buildValhallaTraceBody(request: SnapRequest, costings: {
    walk: string;
    bike: string;
    drive: string;
}, units?: UnitsSystem): Record<string, unknown>;
export declare function buildAttributeFilter(attributes: string[] | undefined): Record<string, unknown>;
export interface ValhallaMatchedPoint {
    lat?: number;
    lon?: number;
    type?: string;
    edge_index?: number;
}
export interface SnapResultInput {
    provider: string;
    request: SnapRequest;
    matched: ValhallaMatchedPoint[] | undefined;
    encodedShape?: string;
    edges?: ValhallaTraceEdge[];
}
export declare function toSnapResult(input: SnapResultInput): SnapResult;
export declare function summarizeMatchedWayNames(edges: SnapMatchedEdge[] | undefined): string[];
export declare function summarizeMatchedSurfaces(edges: SnapMatchedEdge[] | undefined): string[];
export declare function toMatchedGeometry(coordinates: unknown): Coordinate[] | undefined;
