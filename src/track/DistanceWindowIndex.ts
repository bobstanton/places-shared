import { finishWork } from '../utils/CooperativeWork';
import { meters, metersToKm } from '../Units';
import { DistanceCalculator, type Coordinate } from '../geo/DistanceCalculator';

const BOUNDS_PADDING_KM = metersToKm(meters(1));

interface Range {
  start: number;
  end: number;
  center: Coordinate;
  radiusKm: number;
  left?: Range;
  right?: Range;
}

export class DistanceWindowIndex {
  private root?: Range;
  private pathDistances?: Float64Array | null;

  constructor(private readonly coordinates: Coordinate[]) {}

  outside(target: Coordinate, start: number, end: number, windowKm: number, reverse: boolean, targetIndex?: number): number {
    return finishWork(this.outsideWork(target, start, end, windowKm, reverse, targetIndex));
  }

  *outsideWork(target: Coordinate, start: number, end: number, windowKm: number, reverse: boolean, targetIndex?: number): Generator<void, number> {
    for (let checked = 0; checked < 4 && start < end; checked++) {
      const i = reverse ? --end : start++;

      if (DistanceCalculator.calculateDistanceBetween(target, this.coordinates[i]) > windowKm) return i;
    }

    if (start >= end) return -1;

    if (targetIndex !== undefined && this.coordinates[targetIndex] === target && windowKm > BOUNDS_PADDING_KM) {
      if (this.pathDistances === undefined) this.pathDistances = yield* this.buildPathDistances();
      const distances = this.pathDistances;

      if (distances) {
        const limit = distances[targetIndex] + (reverse ? -1 : 1) * (windowKm - BOUNDS_PADDING_KM);
        let low = start, high = end;

        while (low < high) {
          const middle = (low + high) >>> 1;

          if (reverse ? distances[middle] < limit : distances[middle] <= limit) low = middle + 1;
          else high = middle;
        }

        if (reverse) end = low;
        else start = low;

        for (let checked = 0; checked < 4 && start < end; checked++) {
          const i = reverse ? --end : start++;

          if (DistanceCalculator.calculateDistanceBetween(target, this.coordinates[i]) > windowKm) return i;
        }

        if (start >= end) return -1;
      }
    }

    if (!this.root) this.root = yield* this.build(0, this.coordinates.length);

    return this.find(this.root, target, start, end, windowKm, reverse);
  }

  private *buildPathDistances(): Generator<void, Float64Array | null> {
    const distances = new Float64Array(this.coordinates.length);

    for (let i = 1; i < distances.length; i++) {
      distances[i] = distances[i - 1] + DistanceCalculator.calculateDistanceBetween(this.coordinates[i - 1], this.coordinates[i]);
      if (!Number.isFinite(distances[i])) return null;
      if (i % 128 === 0) yield;
    }

    return distances;
  }

  private *build(start: number, end: number): Generator<void, Range> {
    const middle = Math.floor((start + end) / 2);
    const center = this.coordinates[middle];
    const range: Range = { start, end, center, radiusKm: 0 };

    if (end - start <= 16) {
      for (let i = start; i < end; i++) range.radiusKm = Math.max(range.radiusKm, DistanceCalculator.calculateDistanceBetween(center, this.coordinates[i]));
    } else {
      range.left = yield* this.build(start, middle);
      range.right = yield* this.build(middle, end);
      range.radiusKm = Math.max(
        DistanceCalculator.calculateDistanceBetween(center, range.left.center) + range.left.radiusKm,
        DistanceCalculator.calculateDistanceBetween(center, range.right.center) + range.right.radiusKm,
      );
    }

    range.radiusKm += BOUNDS_PADDING_KM;
    if (end - start <= 16) yield;

    return range;
  }

  private find(range: Range, target: Coordinate, start: number, end: number, windowKm: number, reverse: boolean): number {
    if (range.end <= start || range.start >= end) return -1;
    if (DistanceCalculator.calculateDistanceBetween(target, range.center) + range.radiusKm < windowKm) return -1;

    if (range.left && range.right) {
      const first = this.find(reverse ? range.right : range.left, target, start, end, windowKm, reverse);

      return first >= 0 ? first : this.find(reverse ? range.left : range.right, target, start, end, windowKm, reverse);
    }

    const low = Math.max(start, range.start), high = Math.min(end, range.end);

    for (let i = reverse ? high - 1 : low; i >= low && i < high; i += reverse ? -1 : 1) {
      if (DistanceCalculator.calculateDistanceBetween(target, this.coordinates[i]) > windowKm) return i;
    }

    return -1;
  }
}
