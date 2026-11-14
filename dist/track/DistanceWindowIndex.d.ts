import { type Coordinate } from '../geo/DistanceCalculator';
export declare class DistanceWindowIndex {
    private readonly coordinates;
    private root?;
    private pathDistances?;
    constructor(coordinates: Coordinate[]);
    outside(target: Coordinate, start: number, end: number, windowKm: number, reverse: boolean, targetIndex?: number): number;
    outsideWork(target: Coordinate, start: number, end: number, windowKm: number, reverse: boolean, targetIndex?: number): Generator<void, number>;
    private buildPathDistances;
    private build;
    private find;
}
