import type { Coordinate } from '../geo/DistanceCalculator';
import { DEFAULT_GRADE_WINDOW, DEFAULT_SPEED_WINDOW, type MetricWindow } from '../settings/MetricWindow';
import { PolylineCodec } from './PolylineCodec';
import { SegmentCreator, GradeColoredSegment } from './SegmentCreator';
import { Meters } from '../Units';
import { finishWork, CooperativeWorkQueue } from '../utils/CooperativeWork';
import { sharedRegistryValue } from '../utils/CrossBundleRegistry';

export const trackGradientWork = sharedRegistryValue(Symbol.for('places.gradient-work-queue'), () => new CooperativeWorkQueue());

import { TRACK_STYLE_DEFAULTS, mergeWithDefaults } from './TrackVisibilityResolver';

export interface TrackStyle {
  style: 'solid' | 'dashed';
  dashArray?: number[];
  color?: string;
  outlineColor?: string;
  weight?: number;
  outlineWeight?: number;
  opacity?: number;
  outlineOpacity?: number;
  outlineStyle?: 'solid' | 'dashed';
  outlineDashArray?: number[];
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

export const TRACK_COLOR_BY_MODES = ['none', 'elevation', 'grade', 'speed', 'pace'] as const;

export type TrackColorBy = typeof TRACK_COLOR_BY_MODES[number];

export interface TrackRenderOptions {
  coloringType?: TrackColorBy;
  elevations?: Meters[];
  // Per-point epoch ms, required for speed and pace coloring.
  times?: number[];
  // Span speed is averaged over when coloring by speed or pace.
  speedWindow?: MetricWindow;
  style?: Partial<TrackStyle>;
  gradeWindow?: MetricWindow;
  outlineOverride?: boolean;
}

export class TrackRenderer {
  static createTrackRenderData(routeData: string, options: TrackRenderOptions = {}): TrackRenderResult {
    return finishWork(this.createTrackRenderDataWork(routeData, options));
  }

  static *createTrackRenderDataWork(routeData: string | Coordinate[], options: TrackRenderOptions = {}): Generator<void, TrackRenderResult> {
    const { coloringType, elevations, times, style = {}, gradeWindow = DEFAULT_GRADE_WINDOW, speedWindow = DEFAULT_SPEED_WINDOW, outlineOverride } = options;

    const finalStyle = mergeWithDefaults(style);
    const trackCoords = typeof routeData === 'string' ? PolylineCodec.decode(routeData) : yield* PolylineCodec.quantizeWork(routeData);

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
      segments = yield* SegmentCreator.createElevationColoredSegmentsWork(trackCoords, elevations as Meters[], gradeWindow);
    } else if (coloringType === 'grade') {
      segments = yield* SegmentCreator.createGradeColoredSegmentsWork(trackCoords, elevations as Meters[], gradeWindow);
    } else if (isSpeedMode) {
      segments = yield* SegmentCreator.createSpeedColoredSegmentsWork(trackCoords, times as number[], speedWindow, coloringType);
    } else {
      throw new Error('Invalid coloring type');
    }

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
