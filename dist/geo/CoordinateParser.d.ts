import type { Coordinate } from './DistanceCalculator';
export interface NamedCoordinate extends Coordinate {
    name?: string;
}
export declare function parseNamedCoordinate(value: unknown): NamedCoordinate | null;
export declare function coordinateFromPosition(position: readonly number[]): Coordinate;
export declare function parseCoordinate(value: unknown): Coordinate | null;
export declare function parseCoordinateList(value: unknown): NamedCoordinate[];
