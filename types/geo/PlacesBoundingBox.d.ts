import { Coordinate } from './DistanceCalculator';
export declare class PlacesBoundingBox {
    minLat: number;
    minLng: number;
    maxLat: number;
    maxLng: number;
    private minShiftedLng;
    private maxShiftedLng;
    constructor(minLat?: number, minLng?: number, maxLat?: number, maxLng?: number);
    update(lat: number, lng: number): void;
    getLngLatBounds(): [[number, number], [number, number]];
    getLatLngBounds(): [[number, number], [number, number]];
    getConventionalLatLngBounds(): [[number, number], [number, number]];
    getLngLatCenter(): [number, number];
    getLatLngCenter(): [number, number];
    applyPadding(padding?: number): void;
    contains(lat: number, lng: number): boolean;
    containsCoordinate(coordinate: Coordinate): boolean;
    static fromCoordinates(points: Coordinate[], padding?: number): PlacesBoundingBox;
    static fromPlaces(places: Array<{
        latitude: number;
        longitude: number;
    }>, padding?: number): PlacesBoundingBox;
    static overlaps(box1: PlacesBoundingBox, box2: PlacesBoundingBox): boolean;
    extend(other: PlacesBoundingBox): void;
    private getLongitudeBounds;
    private shiftLongitude;
    private normalizeLongitude;
    isValid(): boolean;
    static fromGeoJSON(geojson: unknown): PlacesBoundingBox;
    private static extractGeoJSONCoordinates;
}
