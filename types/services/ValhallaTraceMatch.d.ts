import { Coordinate } from "../geo/DistanceCalculator";
import { TrackMatchResult } from "./ITrackMatchService";
export declare const VALHALLA_MAX_SHAPE_POINTS = 1500;
export interface ValhallaTraceEdge {
    names?: string[];
    length?: number;
    use?: string;
    surface?: string;
    road_class?: string;
    begin_shape_index?: number;
    end_shape_index?: number;
}
export declare const VALHALLA_TRACE_EDGE_ATTRIBUTES: string[];
export declare const VALHALLA_MATCH_FAILURE_CODES: Set<number>;
export declare function downsampleTrackForTrace(coordinates: Coordinate[], maxPoints?: number): Coordinate[];
export declare function aggregateTraceEdges(edges: ValhallaTraceEdge[], provider: string, shapePointCount?: number, shapeCoords?: Coordinate[]): TrackMatchResult;
export declare function valhallaErrorFromBody(providerLabel: string, status: number, body: string): Error;
