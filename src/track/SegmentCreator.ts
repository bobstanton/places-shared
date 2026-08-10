import type { Coordinate } from '../geo/DistanceCalculator';
import { DistanceCalculator } from '../geo/DistanceCalculator';
import { PolylineCodec } from './PolylineCodec';
import { GradeCalculator } from '../geo/GradeCalculator';
import { ColorSchemes } from './ColorSchemes';
import { Meters, meters, km, kmToMeters } from '../Units';
import { DEFAULT_GRADE_WINDOW, metricWindowKm, type MetricWindow } from '../settings/MetricWindow';

// Tracks render from stored elevations and coordinates with no timestamps,
// and a time window cannot be honoured here. Falling back to the default
// distance keeps the track drawn; the block-level parse is where a time window
// gets reported.
function resolveGradeWindowKm(window: MetricWindow): number {
  return metricWindowKm(window) ?? metricWindowKm(DEFAULT_GRADE_WINDOW) ?? 0.03048;
}

export interface GradeColoredSegment {
  coordinates: Coordinate[];
  grade: number;
  color: string;
  // Speed in km/h for a speed/pace-coloured segment; absent for grade and elevation.
  speedKph?: number;
}

export class SegmentCreator {
  static createElevationColoredSegments(routeData: string, elevations: Meters[], gradeWindow: MetricWindow = DEFAULT_GRADE_WINDOW): GradeColoredSegment[] {
    const coordinates = PolylineCodec.decode(routeData);

    if (coordinates.length !== elevations.length) {
      throw new Error('Coordinates and elevations arrays must have the same length');
    }

    const segments: GradeColoredSegment[] = [];

    if (coordinates.length < 2) return segments;

    let minElevation = elevations[0] as number;
    let maxElevation = elevations[0] as number;
    for (let i = 1; i < elevations.length; i++) {
      const e = elevations[i] as number;
      if (e < minElevation) minElevation = e;
      if (e > maxElevation) maxElevation = e;
    }

    const segmentDistanceKm = resolveGradeWindowKm(gradeWindow);

    const cumulativeDistances: number[] = [0];
    for (let i = 1; i < coordinates.length; i++) {
      const segmentDistance = DistanceCalculator.calculateDistanceBetween(coordinates[i - 1], coordinates[i]);
      cumulativeDistances[i] = cumulativeDistances[i - 1] + segmentDistance;
    }

    let currentSegmentStart = 0;

    for (let i = 1; i < coordinates.length; i++) {
      const currentDistance = cumulativeDistances[i];
      const segmentStartDistance = cumulativeDistances[currentSegmentStart];

      const shouldEndSegment =
        (currentDistance - segmentStartDistance) >= segmentDistanceKm ||
        i === coordinates.length - 1;

      if (shouldEndSegment) {
        let elevSum = 0;
        const elevCount = i + 1 - currentSegmentStart;
        for (let j = currentSegmentStart; j <= i; j++) {
          elevSum += elevations[j] as number;
        }
        const avgElevation = elevSum / elevCount;
        const actualDistance = kmToMeters(km(currentDistance - segmentStartDistance)) as number;
        const grade = GradeCalculator.calculateGrade(elevations[currentSegmentStart], elevations[i], meters(actualDistance));
        const color = ColorSchemes.getElevationColor(avgElevation as Meters, minElevation as Meters, maxElevation as Meters);
        const segmentCoords = coordinates.slice(currentSegmentStart, i + 1);

        segments.push({
          coordinates: segmentCoords,
          grade,
          color
        });

        currentSegmentStart = i;
      }
    }

    return segments;
  }

  static createGradeColoredSegments(routeData: string, elevations: Meters[], gradeWindow: MetricWindow = DEFAULT_GRADE_WINDOW): GradeColoredSegment[] {
    const coordinates = PolylineCodec.decode(routeData);

    if (coordinates.length !== elevations.length) {
      throw new Error('Coordinates and elevations arrays must have the same length');
    }

    const segments: GradeColoredSegment[] = [];

    if (coordinates.length < 2) return segments;

    const gradeDistanceKm = resolveGradeWindowKm(gradeWindow);

    const cumulativeDistances: number[] = [0];
    for (let i = 1; i < coordinates.length; i++) {
      const segmentDistance = DistanceCalculator.calculateDistanceBetween(coordinates[i - 1], coordinates[i]);
      cumulativeDistances[i] = cumulativeDistances[i - 1] + segmentDistance;
    }

    let currentSegmentStart = 0;

    for (let i = 1; i < coordinates.length; i++) {
      const currentDistance = cumulativeDistances[i];
      const segmentStartDistance = cumulativeDistances[currentSegmentStart];

      const shouldEndSegment =
        (currentDistance - segmentStartDistance) >= gradeDistanceKm ||
        i === coordinates.length - 1;

      if (shouldEndSegment) {
        const actualDistance = kmToMeters(km(currentDistance - segmentStartDistance)) as number;
        const grade = GradeCalculator.calculateGrade(elevations[currentSegmentStart], elevations[i], meters(actualDistance));
        const color = ColorSchemes.getGradeColor(grade);

        const segmentCoords = coordinates.slice(currentSegmentStart, i + 1);

        segments.push({
          coordinates: segmentCoords,
          grade,
          color
        });

        currentSegmentStart = i;
      }
    }

    return segments;
  }

  // Segments coloured by speed (or pace) from per-point timestamps. Returns an
  // empty list when timestamps are missing or unusable.
  static createSpeedColoredSegments(
    routeData: string,
    times: number[],
    window: MetricWindow,
    mode: 'speed' | 'pace' = 'speed',
  ): GradeColoredSegment[] {
    const coordinates = PolylineCodec.decode(routeData);
    if (coordinates.length < 2 || coordinates.length !== times.length) return [];

    const speeds = computeWindowedSpeeds(coordinates, times, window);
    const usable = speeds.filter((speed): speed is number => speed !== undefined);
    if (usable.length === 0) return [];

    const minSpeed = Math.min(...usable);
    const maxSpeed = Math.max(...usable);

    const segments: GradeColoredSegment[] = [];
    for (let i = 1; i < coordinates.length; i++) {
      const speed = speeds[i] ?? speeds[i - 1];
      if (speed === undefined) continue;
      segments.push({
        coordinates: [coordinates[i - 1], coordinates[i]],
        grade: 0,
        speedKph: speed,
        color: ColorSchemes.getSpeedColor(speed, minSpeed, maxSpeed, mode === 'pace'),
      });
    }
    return segments;
  }
}

// Speed at each point over a centred window, mirroring TrackPointProcessor.
// Operates on decoded coordinates and epoch times; the render path has no
// parsed track points.
function computeWindowedSpeeds(coordinates: Coordinate[], times: number[], window: MetricWindow): Array<number | undefined> {
  const outside = window.kind === 'time'
    ? (a: number, b: number): boolean => !Number.isFinite(times[a]) || !Number.isFinite(times[b]) || Math.abs(times[b] - times[a]) > window.ms
    : (a: number, b: number): boolean => DistanceCalculator.calculateDistanceBetween(coordinates[a], coordinates[b]) > window.km;

  const cumulative: number[] = [0];
  for (let i = 1; i < coordinates.length; i++) {
    cumulative[i] = cumulative[i - 1] + DistanceCalculator.calculateDistanceBetween(coordinates[i - 1], coordinates[i]);
  }

  return coordinates.map((_, i) => {
    let start = i;
    while (start > 0 && !outside(start - 1, i)) start--;
    let end = i;
    while (end < coordinates.length - 1 && !outside(i, end + 1)) end++;

    const elapsedMs = times[end] - times[start];
    const distanceKm = cumulative[end] - cumulative[start];
    if (!Number.isFinite(elapsedMs) || elapsedMs <= 0 || distanceKm <= 0) return undefined;

    const speed = distanceKm / (elapsedMs / 3_600_000);
    return speed > 0 && speed <= 200 ? speed : undefined;
  });
}
