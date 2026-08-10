import { Kilometers, Meters } from '../Units';
export declare const DEG_TO_RAD: number;
export interface Coordinate {
    latitude: number;
    longitude: number;
}
export declare class DistanceCalculator {
    private static readonly EARTH_RADIUS_KM;
    static calculatePolylineDistanceKm(coordinates: Coordinate[]): Kilometers;
    static calculateDistanceBetween(coord1: Coordinate, coord2: Coordinate): Kilometers;
    static haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): Kilometers;
    static haversineDistanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): Meters;
    private static fastDistanceDegrees;
    static perpendicularDistanceDegrees(point: Coordinate, lineStart: Coordinate, lineEnd: Coordinate): number;
    static pointToSegmentDistanceMeters(point: Coordinate, segStart: Coordinate, segEnd: Coordinate): Meters;
    private static discreteFrechetDistance;
    static discreteFrechetSimilarity(track1: Coordinate[], track2: Coordinate[], threshold?: number): number;
}
