import type { Coordinate } from '../geo/DistanceCalculator';
import { type Kilometers, type KilometersPerHour, type Meters, type MinutesPerKilometer, type UnitsSystem } from '../Units';
export interface TrackNoteFrontmatterInput {
    readonly distanceKm?: Kilometers;
    readonly startCoordinate?: Coordinate;
    readonly totalPoints?: number;
    readonly name?: string;
    readonly description?: string;
    readonly featureCount?: number;
    readonly durationSeconds?: number;
    readonly movingTimeSeconds?: number;
    readonly startTime?: Date;
    readonly endTime?: Date;
    readonly averageSpeedKph?: KilometersPerHour;
    readonly maxSpeedKph?: KilometersPerHour;
    readonly averagePaceMinPerKm?: MinutesPerKilometer;
    readonly bestPaceMinPerKm?: MinutesPerKilometer;
    readonly elevationGainMeters?: Meters;
    readonly elevationLossMeters?: Meters;
    readonly minElevationMeters?: Meters;
    readonly maxElevationMeters?: Meters;
}
export declare function buildTrackNoteFrontmatter(input: TrackNoteFrontmatterInput, units: UnitsSystem): Record<string, unknown>;
export declare function assignFrontmatter(target: Record<string, unknown>, values: Record<string, unknown>): void;
