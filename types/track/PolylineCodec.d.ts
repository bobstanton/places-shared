import type { Coordinate } from '../geo/DistanceCalculator';
export declare class PolylineCodec {
    static encode(coordinates: Coordinate[]): string;
    static decode(encoded: string, precision?: number): Coordinate[];
}
