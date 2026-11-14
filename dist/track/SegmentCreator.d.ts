import type { Coordinate } from '../geo/DistanceCalculator';
import { Meters } from '../Units';
import { type MetricWindow } from '../settings/MetricWindow';
export interface GradeColoredSegment {
    coordinates: Coordinate[];
    grade: number;
    color: string;
    speedKph?: number;
}
export declare class SegmentCreator {
    static createElevationColoredSegments(routeData: string, elevations: Meters[], gradeWindow?: MetricWindow): GradeColoredSegment[];
    static createElevationColoredSegmentsWork(routeData: string | Coordinate[], elevations: Meters[], gradeWindow?: MetricWindow): Generator<void, GradeColoredSegment[]>;
    static createGradeColoredSegments(routeData: string, elevations: Meters[], gradeWindow?: MetricWindow): GradeColoredSegment[];
    static createGradeColoredSegmentsWork(routeData: string | Coordinate[], elevations: Meters[], gradeWindow?: MetricWindow): Generator<void, GradeColoredSegment[]>;
    private static createColoredSegmentsWork;
    static createSpeedColoredSegments(routeData: string, times: number[], window: MetricWindow, mode?: 'speed' | 'pace'): GradeColoredSegment[];
    static createSpeedColoredSegmentsWork(routeData: string | Coordinate[], times: number[], window: MetricWindow, mode?: 'speed' | 'pace'): Generator<void, GradeColoredSegment[]>;
}
