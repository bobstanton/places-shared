import type { Coordinate } from '../geo/DistanceCalculator';
import { type MetricWindow } from '../settings/MetricWindow';
import { GradeColoredSegment } from './SegmentCreator';
import { Meters } from '../Units';
export interface TrackStyle {
    style: 'solid' | 'dashed';
    dashArray?: number[];
    color?: string;
    outlineColor?: string;
    weight?: number;
    outlineWeight?: number;
    opacity?: number;
    outlineOpacity?: number;
}
export interface TrackRenderResult {
    type: 'single' | 'colored';
    segments: GradeColoredSegment[];
    trackCoords: Coordinate[];
    needsOutline: boolean;
    style: TrackStyle;
}
export declare const DEFAULT_TRACK_STYLE: TrackStyle;
export type TrackColorBy = 'none' | 'elevation' | 'grade' | 'speed' | 'pace';
export interface TrackRenderOptions {
    coloringType?: TrackColorBy;
    elevations?: Meters[];
    times?: number[];
    speedWindow?: MetricWindow;
    style?: Partial<TrackStyle>;
    gradeWindow?: MetricWindow;
    outlineOverride?: boolean;
}
export declare class TrackRenderer {
    static createTrackRenderData(routeData: string, options?: TrackRenderOptions): TrackRenderResult;
}
