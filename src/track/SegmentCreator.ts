import type { Coordinate } from '../geo/DistanceCalculator';
import { DistanceCalculator } from '../geo/DistanceCalculator';
import { PolylineCodec } from './PolylineCodec';
import { GradeCalculator } from '../geo/GradeCalculator';
import { ColorSchemes } from './ColorSchemes';
import { Meters, meters, km, kmToMeters } from '../Units';
import { DEFAULT_GRADE_WINDOW, metricWindowKm, type MetricWindow } from '../settings/MetricWindow';
import { calculateWindowedSpeedsWork } from './WindowedSpeeds';
import { finishWork } from '../utils/CooperativeWork';

// Tracks render from stored elevations and coordinates with no timestamps,
// and a time window cannot be honored here. Falling back to the default
// distance keeps the track drawn; the block-level parse is where a time window
// gets reported.
function resolveGradeWindowKm(window: MetricWindow): number {
  return metricWindowKm(window) ?? metricWindowKm(DEFAULT_GRADE_WINDOW) ?? 0.03048;
}

export interface GradeColoredSegment {
  coordinates: Coordinate[];
  grade: number;
  color: string;
  // Speed in km/h for a speed/pace-colored segment; absent for grade and elevation.
  speedKph?: number;
}

export class SegmentCreator {
  static createElevationColoredSegments(routeData: string, elevations: Meters[], gradeWindow: MetricWindow = DEFAULT_GRADE_WINDOW): GradeColoredSegment[] {
    return finishWork(this.createElevationColoredSegmentsWork(routeData, elevations, gradeWindow));
  }

  static *createElevationColoredSegmentsWork(routeData: string | Coordinate[], elevations: Meters[], gradeWindow: MetricWindow = DEFAULT_GRADE_WINDOW): Generator<void, GradeColoredSegment[]> {
    return yield* this.createColoredSegmentsWork(routeData, elevations, gradeWindow, 'elevation');
  }

  static createGradeColoredSegments(routeData: string, elevations: Meters[], gradeWindow: MetricWindow = DEFAULT_GRADE_WINDOW): GradeColoredSegment[] {
    return finishWork(this.createGradeColoredSegmentsWork(routeData, elevations, gradeWindow));
  }

  static *createGradeColoredSegmentsWork(routeData: string | Coordinate[], elevations: Meters[], gradeWindow: MetricWindow = DEFAULT_GRADE_WINDOW): Generator<void, GradeColoredSegment[]> {
    return yield* this.createColoredSegmentsWork(routeData, elevations, gradeWindow, 'grade');
  }

  private static *createColoredSegmentsWork(routeData: string | Coordinate[], elevations: Meters[], gradeWindow: MetricWindow, mode: 'grade' | 'elevation'): Generator<void, GradeColoredSegment[]> {
    const coordinates = typeof routeData === 'string' ? PolylineCodec.decode(routeData) : routeData;

    if (coordinates.length !== elevations.length) {
      throw new Error('Coordinates and elevations arrays must have the same length');
    }

    const segments: GradeColoredSegment[] = [];

    if (coordinates.length < 2) return segments;

    let minElevation = elevations[0] as number;
    let maxElevation = elevations[0] as number;

    if (mode === 'elevation') {
      for (let i = 1; i < elevations.length; i++) {
        const e = elevations[i] as number;

        if (e < minElevation) minElevation = e;
        if (e > maxElevation) maxElevation = e;
        if (i % 128 === 0) yield;
      }
    }

    const segmentDistanceKm = resolveGradeWindowKm(gradeWindow);

    const cumulativeDistances: number[] = [0];

    for (let i = 1; i < coordinates.length; i++) {
      const segmentDistance = DistanceCalculator.calculateDistanceBetween(coordinates[i - 1], coordinates[i]);

      cumulativeDistances[i] = cumulativeDistances[i - 1] + segmentDistance;
      if (i % 128 === 0) yield;
    }

    let currentSegmentStart = 0;

    for (let i = 1; i < coordinates.length; i++) {
      const currentDistance = cumulativeDistances[i];
      const segmentStartDistance = cumulativeDistances[currentSegmentStart];

      const shouldEndSegment =
        (currentDistance - segmentStartDistance) >= segmentDistanceKm ||
        i === coordinates.length - 1;

      if (shouldEndSegment) {
        const actualDistance = kmToMeters(km(currentDistance - segmentStartDistance));
        const grade = GradeCalculator.calculateGrade(elevations[currentSegmentStart], elevations[i], actualDistance);
        let color: string;

        if (mode === 'elevation') {
          let elevSum = 0;

          for (let j = currentSegmentStart; j <= i; j++) {
            elevSum += elevations[j] as number;
            if (j % 128 === 0) yield;
          }

          const avgElevation = meters(elevSum / (i + 1 - currentSegmentStart));

          color = ColorSchemes.getElevationColor(avgElevation, minElevation as Meters, maxElevation as Meters);
        } else {
          color = ColorSchemes.getGradeColor(grade);
        }

        const segmentCoords = coordinates.slice(currentSegmentStart, i + 1);

        segments.push({
          coordinates: segmentCoords,
          grade,
          color
        });

        currentSegmentStart = i;
      }

      if (i % 128 === 0) yield;
    }

    return segments;
  }

  static createSpeedColoredSegments(routeData: string, times: number[], window: MetricWindow, mode: 'speed' | 'pace' = 'speed'): GradeColoredSegment[] {
    return finishWork(this.createSpeedColoredSegmentsWork(routeData, times, window, mode));
  }

  static *createSpeedColoredSegmentsWork(routeData: string | Coordinate[], times: number[], window: MetricWindow, mode: 'speed' | 'pace' = 'speed'): Generator<void, GradeColoredSegment[]> {
    const coordinates = typeof routeData === 'string' ? PolylineCodec.decode(routeData) : routeData;

    if (coordinates.length < 2 || coordinates.length !== times.length) return [];

    const speeds = yield* calculateWindowedSpeedsWork(coordinates, times, window);
    let min = Infinity, max = -Infinity;

    for (let i = 0; i < speeds.length; i++) {
      const speed = speeds[i];

      if (speed !== undefined) { min = Math.min(min, speed); max = Math.max(max, speed); }
      if (i % 128 === 0) yield;
    }

    if (min === Infinity) return [];

    const segments: GradeColoredSegment[] = [];

    for (let i = 1; i < coordinates.length; i++) {
      const speed = speeds[i] ?? speeds[i - 1];

      if (i % 128 === 0) yield;
      if (speed === undefined) continue;
      segments.push({
        coordinates: [coordinates[i - 1], coordinates[i]],
        grade: 0,
        speedKph: speed,
        color: ColorSchemes.getSpeedColor(speed, min, max, mode === 'pace'),
      });
    }

    return segments;
  }
}
