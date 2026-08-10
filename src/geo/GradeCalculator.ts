import { Meters, Kilometers, kmToMeters, km, meters } from '../Units';
import type { MetricWindow } from '../settings/MetricWindow';

export class GradeCalculator {

  static calculateGradeBetweenPoints(startElevation: Meters, endElevation: Meters, startDistance: Kilometers, endDistance: Kilometers): number {
    const distanceKm = km(endDistance - startDistance);
    if (distanceKm === 0) return 0;

    const horizontalDistanceMeters = kmToMeters(distanceKm);
    const elevationChange = endElevation - startElevation;
    return (elevationChange / horizontalDistanceMeters) * 100;
  }

  static calculateGrade(startElevation: Meters, endElevation: Meters, horizontalDistanceMeters: Meters): number {
    if (horizontalDistanceMeters === 0) return 0;
    const elevationChange = endElevation - startElevation;
    return (elevationChange / horizontalDistanceMeters) * 100;
  }

  static calculateRollingGrade<T extends { distanceKm: Kilometers; elevationMeters?: Meters; time?: Date }>(
    points: T[],
    currentIndex: number,
    window: MetricWindow,
  ): number {
    if (currentIndex === 0) return 0;

    const startIndex = window.kind === 'time'
      ? this.findTimeWindowStart(points, currentIndex, window.ms)
      : this.findDistanceWindowStart(points, currentIndex, km(window.km));

    return this.calculateGradeBetweenPoints(
      points[startIndex].elevationMeters || meters(0),
      points[currentIndex].elevationMeters || meters(0),
      points[startIndex].distanceKm,
      points[currentIndex].distanceKm
    );
  }

  private static findDistanceWindowStart<T extends { distanceKm: Kilometers }>(points: T[], currentIndex: number, windowDistanceKm: Kilometers): number {
    const targetDistanceKm = points[currentIndex].distanceKm - windowDistanceKm;
    for (let i = currentIndex - 1; i >= 0; i--) {
      if (points[i].distanceKm <= targetDistanceKm) return i;
      if (i === 0) return 0;
    }
    return currentIndex - 1;
  }

  private static findTimeWindowStart<T extends { time?: Date }>(points: T[], currentIndex: number, windowMs: number): number {
    const currentTime = points[currentIndex].time?.getTime();
    if (currentTime === undefined) return currentIndex - 1;

    for (let i = currentIndex - 1; i >= 0; i--) {
      const time = points[i].time?.getTime();
      // End the window at an untimed point rather than treating it as adjacent
      // to the current one, which would report a grade over an unknown span.
      if (time === undefined) return Math.min(i + 1, currentIndex - 1);
      if (currentTime - time >= windowMs) return i;
      if (i === 0) return 0;
    }
    return currentIndex - 1;
  }
}
