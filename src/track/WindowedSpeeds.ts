import { DistanceCalculator, type Coordinate } from '../geo/DistanceCalculator';
import type { MetricWindow } from '../settings/MetricWindow';
import { DistanceWindowIndex } from './DistanceWindowIndex';
import { finishWork } from '../utils/CooperativeWork';

export function calculateWindowedSpeeds(coordinates: Coordinate[], times: number[], window: MetricWindow, segmentDistances?: readonly number[]): Array<number | undefined> {
  return finishWork(calculateWindowedSpeedsWork(coordinates, times, window, segmentDistances));
}

export function* calculateWindowedSpeedsWork(coordinates: Coordinate[], times: number[], window: MetricWindow, segmentDistances?: readonly number[]): Generator<void, Array<number | undefined>> {
  const index = window.kind === 'distance' ? new DistanceWindowIndex(coordinates) : undefined;
  const outsideTime = window.kind === 'time'
    ? (a: number, b: number): boolean => !Number.isFinite(times[a]) || !Number.isFinite(times[b]) || Math.abs(times[b] - times[a]) > window.ms
    : undefined;

  const cumulative: number[] = [0];

  for (let i = 1; i < coordinates.length; i++) {
    cumulative[i] = cumulative[i - 1] + (segmentDistances?.[i] ?? DistanceCalculator.calculateDistanceBetween(coordinates[i - 1], coordinates[i]));
    if (i % 128 === 0) yield;
  }

  const speeds: Array<number | undefined> = new Array<number | undefined>(coordinates.length);

  for (let i = 0; i < coordinates.length; i++) {
    speeds[i] = undefined;
    let start = i, end = i;

    if (index && window.kind === 'distance') {
      start = (yield* index.outsideWork(coordinates[i], 0, i, window.km, true, i)) + 1;
      const after = yield* index.outsideWork(coordinates[i], i + 1, coordinates.length, window.km, false, i);

      end = after < 0 ? coordinates.length - 1 : after - 1;
    } else if (outsideTime) {
      while (start > 0 && !outsideTime(start - 1, i)) { start--; if (start % 128 === 0) yield; }
      while (end < coordinates.length - 1 && !outsideTime(i, end + 1)) { end++; if (end % 128 === 0) yield; }
    }

    const elapsedMs = times[end] - times[start];
    const distanceKm = cumulative[end] - cumulative[start];

    if (Number.isFinite(elapsedMs) && elapsedMs > 0 && distanceKm > 0) {
      const speed = distanceKm / (elapsedMs / 3_600_000);

      speeds[i] = speed > 0 && speed <= 200 ? speed : undefined;
    }

    if (i % 128 === 0) yield;
  }

  return speeds;
}
