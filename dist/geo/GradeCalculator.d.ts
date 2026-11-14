import { Meters, Kilometers } from '../Units';
import type { MetricWindow } from '../settings/MetricWindow';
export declare class GradeCalculator {
    static calculateGradeBetweenPoints(startElevation: Meters, endElevation: Meters, startDistance: Kilometers, endDistance: Kilometers): number;
    static calculateGrade(startElevation: Meters, endElevation: Meters, horizontalDistanceMeters: Meters): number;
    static calculateRollingGrade<T extends {
        distanceKm: Kilometers;
        elevationMeters?: Meters;
        time?: Date;
    }>(points: T[], currentIndex: number, window: MetricWindow): number;
    private static findDistanceWindowStart;
    private static findTimeWindowStart;
}
