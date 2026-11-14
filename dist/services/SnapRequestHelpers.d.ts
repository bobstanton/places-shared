import type { Coordinate } from '../geo/index';
import { type SnapMatchedEdge, type SnapRequest, type SnapResult } from './index';
import type { UnitsSystem } from '../units/index';
import type { ValhallaTraceEdge } from './index';
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
