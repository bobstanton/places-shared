import type { Coordinate } from '../geo/DistanceCalculator';
export declare class PolylineCodec {
    static encode(coordinates: Coordinate[]): string;
    static quantizeWork(coordinates: Coordinate[]): Generator<void, Coordinate[]>;
    static decode(encoded: string, precision?: number): Coordinate[];
}
