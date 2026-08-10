import type { Coordinate } from '../geo/DistanceCalculator';
import { DEFAULT_GRADE_WINDOW, DEFAULT_SPEED_WINDOW, type MetricWindow } from '../settings/MetricWindow';
import { PolylineCodec } from './PolylineCodec';
import { SegmentCreator, GradeColoredSegment } from './SegmentCreator';
import { Meters } from '../Units';
import { } from '../settings/MapDefaults';
import { TRACK_STYLE_DEFAULTS } from './TrackVisibilityResolver';

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

export const DEFAULT_TRACK_STYLE: TrackStyle = {
  style: TRACK_STYLE_DEFAULTS.style,
  dashArray: TRACK_STYLE_DEFAULTS.dashArray,
  color: TRACK_STYLE_DEFAULTS.color,
  outlineColor: TRACK_STYLE_DEFAULTS.outlineColor,
  weight: TRACK_STYLE_DEFAULTS.weight,
  outlineWeight: TRACK_STYLE_DEFAULTS.outlineWeight,
  opacity: TRACK_STYLE_DEFAULTS.opacity,
  outlineOpacity: TRACK_STYLE_DEFAULTS.outlineOpacity
};

export type TrackColorBy = 'none' | 'elevation' | 'grade' | 'speed' | 'pace';

export interface TrackRenderOptions {
  coloringType?: TrackColorBy;
  elevations?: Meters[];
  // Per-point epoch ms, required for speed and pace colouring.
  times?: number[];
  // Span speed is averaged over when colouring by speed or pace.
  speedWindow?: MetricWindow;
  style?: Partial<TrackStyle>;
  gradeWindow?: MetricWindow;
  outlineOverride?: boolean;
}

export class TrackRenderer {
  static createTrackRenderData(routeData: string, options: TrackRenderOptions = {}): TrackRenderResult {
    const { coloringType, elevations, times, style = {}, gradeWindow = DEFAULT_GRADE_WINDOW, speedWindow = DEFAULT_SPEED_WINDOW, outlineOverride } = options;

    const finalStyle: TrackStyle = { ...DEFAULT_TRACK_STYLE, ...style };
    const trackCoords = PolylineCodec.decode(routeData);

    // Elevation and grade need per-point elevations; speed and pace need
    // per-point times. A track missing what its mode requires renders flat
    // rather than silently switching to another colouring.
    const isSpeedMode = coloringType === 'speed' || coloringType === 'pace';
    const canColor = isSpeedMode
      ? Boolean(times && times.length === trackCoords.length)
      : Boolean(coloringType && (coloringType === 'elevation' || coloringType === 'grade')
        && elevations && elevations.length === trackCoords.length);

    if (!canColor) {
      const needsOutline = outlineOverride !== undefined ? outlineOverride : false;
      return {
        type: 'single',
        segments: [],
        trackCoords,
        needsOutline,
        style: finalStyle
      };
    }

    let segments: GradeColoredSegment[];
    if (coloringType === 'elevation') {
      segments = SegmentCreator.createElevationColoredSegments(routeData, elevations as Meters[], gradeWindow);
    } else if (coloringType === 'grade') {
      segments = SegmentCreator.createGradeColoredSegments(routeData, elevations as Meters[], gradeWindow);
    } else if (isSpeedMode) {
      segments = SegmentCreator.createSpeedColoredSegments(routeData, times as number[], speedWindow, coloringType);
    } else {
      throw new Error('Invalid coloring type');
    }

    // Timestamps can be present but unusable (all identical, or a stationary
    // track); an empty segment list falls back to a plain line.
    if (segments.length === 0) {
      return {
        type: 'single',
        segments: [],
        trackCoords,
        needsOutline: outlineOverride ?? false,
        style: finalStyle,
      };
    }

    const needsOutline = outlineOverride !== undefined ? outlineOverride : true;
    return {
      type: 'colored',
      segments,
      trackCoords,
      needsOutline,
      style: finalStyle
    };
  }
}
